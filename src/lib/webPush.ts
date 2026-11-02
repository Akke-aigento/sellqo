import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getInstallId } from '@/lib/installId';
import { errorDetail, isSaveFailure, saveDeviceToken, type PushFailReason } from '@/lib/pushTokens';
import type { Db } from '@/lib/supabaseScope';

/**
 * WEBPUSH-1 — web push voor de SellQo-webapp (beginscherm-app of browser).
 *
 * Waarom: sommige bedrijfstelefoons (MDM) blokkeren TestFlight, dus daar staat
 * SellQo als webapp op het beginscherm in plaats van als native app.
 *
 * Regels:
 * - Nooit binnen de native app. Daar loopt push via FCM (src/native/
 *   pushRegistration.ts); een tweede, web-abonnement zou elke melding
 *   dubbel geven. Ook niet in een iframe (Lovable-preview).
 * - Op iOS kan web push alleen vanuit een app op het beginscherm (iOS 16.4+).
 *   In gewoon Safari tonen we de installatie-instructie in plaats van de knop.
 * - Toestemming vragen gebeurt alleen na een tik van de gebruiker.
 * - Een server kan niet zien dat een web-abonnement en een native app op
 *   dezelfde telefoon staan. Daarom bewaren we het besturingssysteem (`os`)
 *   en laten we de gebruiker bevestigen: hier vóór het inschrijven, en in de
 *   native app via NativeWebPushDuplicateDialog.
 * - KASSA-MOBIEL-1: kassa en beheer hebben elk een eigen aanmelding. Een browser heeft per
 *   service-worker-registratie één push-abonnement; de kassa schrijft zich daarom in met een eigen
 *   registratie (scope /kassa/) en haar eigen client (`opts.db`), zodat de kassa-account en de
 *   beheer-account niet om hetzelfde endpoint vechten. Zonder opts: beheer zoals vroeger.
 */

/** KASSA-MOBIEL-1: welke client en welke service-worker-scope (leeg = beheer, scope '/'). */
export interface WebPushOpts {
  db?: Db;
  scope?: string;
}

/** Publiek deel van het VAPID-sleutelpaar. Moet gelijk zijn aan supabase/functions/_shared/webpush.ts. */
export const WEB_PUSH_PUBLIC_KEY =
  'BCPFT36NUbP7t_OwATpVwFWz-QVgMKr9hzPiaAOf3eyqUiR2lEeIoXR2L3jD3JVyhMIbtGUtTISdwXlxFDbmn9A';

export type DeviceOs = 'ios' | 'android' | 'desktop';

export type WebPushState =
  /** Draait in de native app: daar regelt FCM de meldingen. */
  | 'native-app'
  /** Browser kan geen web push, of we zitten in een iframe. */
  | 'unsupported'
  /** iOS/iPadOS in gewoon Safari: eerst op het beginscherm zetten. */
  | 'needs-install'
  /** Gebruiker heeft meldingen voor deze site geblokkeerd. */
  | 'denied'
  /** Kan aangezet worden. */
  | 'off'
  /** Staat aan op dit toestel. */
  | 'on';

export interface DeviceRow {
  id: string;
  token: string;
  platform: string;
  os: string | null;
  device_name: string | null;
  last_seen_at: string;
}

const SW_URL = '/sw.js';

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function detectOs(): DeviceOs {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ doet zich voor als Mac; het verschil is het aanraakscherm.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

function browserSupportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Korte omschrijving voor in device_tokens.device_name. */
function describeDevice(os: DeviceOs): string {
  if (os === 'ios') {
    const ua = navigator.userAgent;
    const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    return isIpad ? 'iPad' : 'iPhone';
  }
  if (os === 'android') return 'Android';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function existingSubscription(scope?: string): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(scope ?? SW_URL);
  if (!reg) return null;
  // getRegistration geeft de best passende registratie: zonder eigen /kassa/-registratie is dat die van beheer.
  if (scope && new URL(reg.scope).pathname !== scope) return null;
  return reg.pushManager.getSubscription();
}

/** Wacht tot de worker van déze registratie actief is (navigator.serviceWorker.ready wacht op die van de pagina,
 *  en een pagina op /kassa valt niet onder scope /kassa/). */
async function activeRegistration(reg: ServiceWorkerRegistration, timeoutMs = 10_000): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (!worker) throw new Error('service worker zonder installatie');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('service worker niet actief binnen 10 s')), timeoutMs);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
      if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('service worker redundant')); }
    });
  });
  return reg;
}

/** Huidige stand op dit toestel. Vraagt nooit toestemming; veilig bij mount. */
export async function getWebPushState(userId: string | null, opts: WebPushOpts = {}): Promise<WebPushState> {
  if (Capacitor.isNativePlatform()) return 'native-app';
  if (isInIframe()) return 'unsupported';
  if (detectOs() === 'ios' && !isStandalone()) return 'needs-install';
  if (!browserSupportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted' || !userId) return 'off';

  try {
    const sub = await existingSubscription(opts.scope);
    if (!sub) return 'off';
    // De rij kan elders verwijderd zijn (toestellenlijst, of de native app die
    // web-meldingen op dezelfde telefoon uitzette). Dan staat het hier uit.
    const { data } = await (opts.db ?? supabase)
      .from('device_tokens')
      .select('id')
      .eq('token', sub.endpoint)
      .eq('user_id', userId)
      .maybeSingle();
    return data ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * Een actieve native app van hetzelfde besturingssysteem (laatste 30 dagen).
 * Staat SellQo als native app op déze telefoon, dan geeft web push dubbele
 * meldingen. Alleen de gebruiker weet of het dezelfde telefoon is.
 */
export async function findRecentNativeSameOs(userId: string): Promise<DeviceRow | null> {
  const os = detectOs();
  if (os === 'desktop') return null;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('device_tokens')
    .select('id, token, platform, os, device_name, last_seen_at')
    .eq('user_id', userId)
    .eq('platform', os)
    .gte('last_seen_at', since)
    .order('last_seen_at', { ascending: false })
    .limit(1);
  return (data?.[0] as DeviceRow | undefined) ?? null;
}

export type SubscribeResult = 'on' | 'denied' | 'error';

/** KASSA-MOBIEL-1: met reden en technische melding, zodat "Het lukte niet" uitlegt waarom. */
export interface PushOutcome {
  status: SubscribeResult;
  reason?: PushFailReason;
  detail?: string;
}

/** Zet web push aan op dit toestel. Alleen aanroepen vanuit een tik. */
export async function subscribeWebPush(userId: string, opts: WebPushOpts = {}): Promise<SubscribeResult> {
  return (await subscribeWebPushDetailed(userId, opts)).status;
}

export async function subscribeWebPushDetailed(userId: string, opts: WebPushOpts = {}): Promise<PushOutcome> {
  if (Capacitor.isNativePlatform() || isInIframe() || !browserSupportsPush()) return { status: 'error', reason: 'unsupported', detail: 'no web push here' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return permission === 'denied' ? { status: 'denied' } : { status: 'error', reason: 'permission', detail: `Notification.permission=${permission}` };
  }

  let sub: PushSubscription | null;
  try {
    const reg = await activeRegistration(await navigator.serviceWorker.register(SW_URL, { scope: opts.scope ?? '/' }));
    try {
      sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY) as unknown as BufferSource,
        });
      }
    } catch (e) {
      console.error('[webpush] subscribe failed', e);
      return { status: 'error', reason: 'subscribe', detail: errorDetail(e) };
    }
  } catch (e) {
    console.error('[webpush] service worker failed', e);
    return { status: 'error', reason: 'service_worker', detail: errorDetail(e) };
  }

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return { status: 'error', reason: 'keys', detail: 'subscription without endpoint/keys' };

  const os = detectOs();
  const saved = await saveDeviceToken(opts.db ?? supabase, userId, {
    token: json.endpoint,
    platform: 'web',
    os,
    p256dh,
    auth,
    device_name: describeDevice(os),
    // MELDING-1: profiel per toestel (horeca_notify_devices) hangt hieraan.
    install_id: getInstallId(),
  });
  if (isSaveFailure(saved)) {
    console.error('[webpush] device_tokens save failed', saved);
    return { status: 'error', reason: saved.reason, detail: saved.detail };
  }
  return { status: 'on' };
}

/** Zet web push uit op dit toestel. */
export async function unsubscribeWebPush(opts: WebPushOpts = {}): Promise<void> {
  if (Capacitor.isNativePlatform() || !browserSupportsPush()) return;
  try {
    const sub = await existingSubscription(opts.scope);
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const { error } = await (opts.db ?? supabase).from('device_tokens').delete().eq('token', endpoint);
    if (error) console.warn('[webpush] device_tokens delete failed', error);
  } catch (e) {
    console.warn('[webpush] unsubscribe failed', e);
  }
}

/**
 * Houdt last_seen_at van dit web-abonnement vers, zodat de toestellenlijst
 * klopt. Stil, geen toestemmingsvraag; doet niets als er geen abonnement is.
 */
export async function touchWebPushSubscription(userId: string): Promise<void> {
  if (Capacitor.isNativePlatform() || isInIframe() || !browserSupportsPush()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const sub = await existingSubscription();
    if (!sub) return;
    await supabase
      .from('device_tokens')
      .update({ last_seen_at: new Date().toISOString(), install_id: getInstallId() } as never)
      .eq('token', sub.endpoint)
      .eq('user_id', userId);
  } catch {
    // stil: dit is enkel boekhouding
  }
}

/** Endpoint van het abonnement op dit toestel, om "dit toestel" te markeren. */
export async function currentWebPushEndpoint(): Promise<string | null> {
  if (Capacitor.isNativePlatform() || !browserSupportsPush()) return null;
  try {
    return (await existingSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

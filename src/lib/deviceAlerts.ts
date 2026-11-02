// MELDING-1 — horeca-meldingen per toestel: profiel lezen/bewaren en push op dit toestel aanzetten.
//
// Profiel = horeca_notify_devices (per zaak en installatie). Bewaren gaat enkel via de RPC's
// (tenant_admin of staff). Push zelf: web push (browser/beginscherm-app) of FCM in de native app;
// beide registreren met de installatie-ID (src/lib/installId.ts), zodat het profiel het token vindt.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getInstallId } from '@/lib/installId';
import { getWebPushState, subscribeWebPushDetailed, unsubscribeWebPush, type PushOutcome, type WebPushOpts, type WebPushState } from '@/lib/webPush';
import { lastPushRegistrationFailure, registerPushForUser, unregisterPushForUser } from '@/native/pushRegistration';
import type { Db } from '@/lib/supabaseScope';
import { isSaveFailure } from '@/lib/pushTokens';

export type HorecaAlertEvent = 'qr_request' | 'ticket_new' | 'ticket_ready' | 'paid_online';
export const HORECA_ALERT_EVENTS: HorecaAlertEvent[] = ['qr_request', 'ticket_new', 'ticket_ready', 'paid_online'];
export type DeviceKind = 'kassa' | 'station' | 'phone' | 'other';
export const DEVICE_KINDS: DeviceKind[] = ['kassa', 'station', 'phone', 'other'];

/** Wat een nieuw toestel van dit soort standaard ontvangt (aanpasbaar in Kassa (POS) › Kassa's). */
export const DEFAULT_EVENTS: Record<DeviceKind, HorecaAlertEvent[]> = {
  kassa: ['qr_request', 'ticket_ready', 'paid_online'],
  station: ['ticket_new'],
  phone: ['qr_request', 'paid_online'],
  other: [],
};
/** Persoonlijke meldingen (facturen, webshop …) van wie aangemeld is: uit op gedeelde toestellen. */
export const DEFAULT_PERSONAL: Record<DeviceKind, boolean> = { kassa: false, station: false, phone: true, other: true };

export interface DeviceProfile {
  install_id: string;
  name: string;
  kind: DeviceKind;
  events: HorecaAlertEvent[];
  station_ids: string[];
  personal: boolean;
  lang: string;
  updated_at?: string;
  /** Enkel in de lijst: heeft dit toestel een push-inschrijving van iemand uit het team? */
  push?: boolean;
  os?: string | null;
  platforms?: string[] | null;
  last_seen_at?: string | null;
}

// KASSA-MOBIEL-1: elke functie neemt optioneel de client van de omgeving (de kassa-client in de kassa); zonder
// argument de beheer-client zoals vroeger.
const rpc = (fn: string, args: Record<string, unknown>, db: Db = supabase) =>
  (db.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);

export async function listDevices(tenantId: string): Promise<DeviceProfile[]> {
  const { data, error } = await rpc('horeca_notify_devices_list', { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  return (data ?? []) as DeviceProfile[];
}

export async function loadThisDevice(tenantId: string, db: Db = supabase): Promise<DeviceProfile | null> {
  const { data, error } = await db.from('horeca_notify_devices' as never)
    .select('install_id, name, kind, events, station_ids, personal, lang, updated_at')
    .eq('tenant_id' as never, tenantId as never).eq('install_id' as never, getInstallId() as never).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DeviceProfile | null) ?? null;
}

export async function saveDevice(tenantId: string, p: Omit<DeviceProfile, 'updated_at' | 'push' | 'os' | 'platforms' | 'last_seen_at'>, db: Db = supabase): Promise<void> {
  const { error } = await rpc('horeca_notify_device_save', {
    p_tenant_id: tenantId, p_install_id: p.install_id, p_name: p.name, p_kind: p.kind,
    p_events: p.events, p_station_ids: p.station_ids, p_personal: p.personal, p_lang: p.lang,
  }, db);
  if (error) throw new Error(error.message);
}

export async function removeDevice(tenantId: string, installId: string, db: Db = supabase): Promise<void> {
  const { error } = await rpc('horeca_notify_device_remove', { p_tenant_id: tenantId, p_install_id: installId }, db);
  if (error) throw new Error(error.message);
}

export type PushHere = WebPushState;

/** Met welke client en service-worker-scope push hier inschrijft (WebPushOpts: db + scope). */
export type PushTarget = WebPushOpts;

/** Stand van push op dit toestel. In de native app: 'on' als er een token met deze installatie is. */
export async function pushStateHere(userId: string | null, push: PushTarget = {}): Promise<PushHere> {
  if (!Capacitor.isNativePlatform()) return getWebPushState(userId, push);
  if (!userId) return 'off';
  const { data } = await (push.db ?? supabase).from('device_tokens').select('id').eq('user_id', userId)
    .eq('install_id' as never, getInstallId() as never).neq('platform', 'web').limit(1);
  return data && data.length > 0 ? 'on' : 'off';
}

/** Zet push aan op dit toestel. Enkel vanuit een tik (de browser of het OS vraagt toestemming).
 *  KASSA-MOBIEL-1: met reden en technische melding bij een fout (de toast toonde enkel "Het lukte niet"). */
export async function enablePushHere(userId: string, push: PushTarget = {}): Promise<PushOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await registerPushForUser(userId, push.db ?? supabase);
      if (isSaveFailure(r)) return { status: 'error', reason: r.reason, detail: r.detail };
      if ((await pushStateHere(userId, push)) === 'on') return { status: 'on' };
      // Geen token bewaard: geen toestemming, of een fout die registerPushForUser al meldde.
      const f = lastPushRegistrationFailure();
      return f ? { status: 'error', reason: f.reason, detail: f.detail } : { status: 'denied' };
    } catch (e) {
      return { status: 'error', reason: 'subscribe', detail: e instanceof Error ? e.message : String(e) };
    }
  }
  return subscribeWebPushDetailed(userId, push);
}

/** KASSA-MOBIEL-1: "Het lukte niet" + een korte, begrijpelijke reden (i18n deviceAlerts.push.reason.<reden>) + de
 *  technische melding tussen haakjes. */
export function pushErrorToast(t: (k: string) => string, r: Pick<PushOutcome, 'reason' | 'detail'>, titleKey = 'deviceAlerts.push.errorToast'): { title: string; description?: string } {
  const reason = r.reason ? t(`deviceAlerts.push.reason.${r.reason}`) : '';
  const description = [reason, r.detail ? `(${r.detail})` : ''].filter(Boolean).join(' ');
  return { title: t(titleKey), description: description || undefined };
}

/** Gedeelde toestellen (kassa, post): wie het profiel weghaalt, schrijft het toestel ook uit, anders
 *  krijgt het de persoonlijke meldingen van de aangemelde account. */
export const SHARED_KINDS: DeviceKind[] = ['kassa', 'station'];

/** Zet push uit op dit toestel (web-abonnement of native token weg). */
export async function disablePushHere(push: PushTarget = {}): Promise<void> {
  if (Capacitor.isNativePlatform()) await unregisterPushForUser();
  else await unsubscribeWebPush(push);
}

/** Een gedeeld toestel op afstand stilzetten: geen horeca-meldingen en geen persoonlijke meldingen. Het
 *  profiel blijft bestaan (de lijst toont het niet meer), zodat de push-inschrijving op dat toestel
 *  geen persoonlijke meldingen gaat tonen. */
export async function silenceDevice(tenantId: string, d: DeviceProfile, db: Db = supabase): Promise<void> {
  await saveDevice(tenantId, { install_id: d.install_id, name: d.name, kind: d.kind, events: [], station_ids: [], personal: false, lang: d.lang }, db);
}

/** Stilgezet gedeeld toestel: bestaat als profiel, maar ontvangt niets. */
export function isSilenced(d: Pick<DeviceProfile, 'kind' | 'events' | 'personal'>): boolean {
  return SHARED_KINDS.includes(d.kind) && d.events.length === 0 && !d.personal;
}

/** Korte naam voor dit toestel als er nog geen profiel is. */
export function defaultDeviceName(kind: DeviceKind, fallback: string): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const model = /iPad|Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1 ? 'iPad'
    : /iPhone/i.test(ua) ? 'iPhone' : /Android/i.test(ua) ? 'Android' : null;
  return kind === 'phone' && model ? model : fallback;
}

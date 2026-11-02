import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getInstallId } from '@/lib/installId';
import { isSaveFailure, saveDeviceToken, type SaveTokenFailure, type SaveTokenResult } from '@/lib/pushTokens';
import type { Db } from '@/lib/supabaseScope';

type NativePlatform = 'ios' | 'android';

export type PushPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

let currentUserId: string | null = null;
// KASSA-MOBIEL-1: met welke client (en dus welke sessie) het token bewaard wordt. Beheer = de gegenereerde
// client; de aparte Kassa-app geeft de kassa-client mee (het token hoort bij de toestelaccount).
let currentDb: Db = supabase;
let listenersAttached = false;
let lastRegisteredToken: string | null = null;
let lastRegisteredDb: Db | null = null;

// Dynamic import so the Firebase plugin (which pulls firebase/messaging via
// an optional peer dep) never lands in the web bundle. Native-only path.
async function loadMessaging() {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  // Wrap in a plain object. On Android the plugin is a Capacitor Proxy that
  // forwards *every* property access (including `.then`) to the native bridge.
  // Resolving a promise directly with that proxy triggers JS thenable-resolution
  // → calls `proxy.then()` → "FirebaseMessaging.then() is not implemented on
  // android", killing the whole registration flow. A plain object isn't thenable.
  return { FirebaseMessaging };
}

/** Laatste mislukte bewaring (voor "Meldingen aanzetten": reden + technische melding in de toast). */
let lastFailure: SaveTokenFailure | null = null;
export function lastPushRegistrationFailure() {
  return lastFailure;
}

async function upsertToken(userId: string, token: string, platform: NativePlatform, db: Db): Promise<SaveTokenResult> {
  if (lastRegisteredToken === token && currentUserId === userId && lastRegisteredDb === db) return { ok: true, status: 'cached' };

  // KASSA-MOBIEL-1: via device_token_claim (zet een token van een vorige account op dit toestel over), en de
  // fout verdwijnt niet meer stil: ze komt terug naar de aanroeper. Pas na een geslaagde bewaring onthouden
  // we het token, anders sloeg een volgende poging (andere sessie, zelfde token) de bewaring over.
  const r = await saveDeviceToken(db, userId, {
    token,
    platform,
    // WEBPUSH-1: zelfde veld als bij web-abonnementen, voor de
    // dubbele-melding-check (NativeWebPushDuplicateDialog).
    os: platform,
    device_name: `${platform} device`,
    // MELDING-1: profiel per toestel (horeca_notify_devices) hangt hieraan.
    install_id: getInstallId(),
  });
  if (isSaveFailure(r)) {
    lastFailure = r;
    console.error('[push] device_tokens save failed', r.reason, r.detail);
  } else {
    lastRegisteredToken = token;
    lastRegisteredDb = db;
    lastFailure = null;
  }
  return r;
}

async function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const platform = Capacitor.getPlatform() as NativePlatform;
  const { FirebaseMessaging } = await loadMessaging();

  FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    if (!currentUserId || !token) return;
    void upsertToken(currentUserId, token, platform, currentDb);
  });
}

export async function registerPushForUser(userId: string, db: Db = supabase): Promise<SaveTokenResult | null> {
  if (!Capacitor.isNativePlatform()) return null;

  currentUserId = userId;
  currentDb = db;
  await attachListeners();

  const { FirebaseMessaging } = await loadMessaging();

  const perm = await FirebaseMessaging.checkPermissions();
  let receive = perm.receive;
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    const requested = await FirebaseMessaging.requestPermissions();
    receive = requested.receive;
  }
  if (receive !== 'granted') return null;

  const { token } = await FirebaseMessaging.getToken();
  if (!token) return null;
  const platform = Capacitor.getPlatform() as NativePlatform;
  return upsertToken(userId, token, platform, db);
}

export async function unregisterPushForUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const token = lastRegisteredToken;
  const db = lastRegisteredDb ?? currentDb;
  currentUserId = null;
  lastRegisteredToken = null;
  lastRegisteredDb = null;
  currentDb = supabase;

  try {
    const { FirebaseMessaging } = await loadMessaging();
    await FirebaseMessaging.deleteToken();
  } catch (e) {
    console.warn('[push] FirebaseMessaging.deleteToken failed', e);
  }

  if (!token) return;
  const { error } = await db.from('device_tokens').delete().eq('token', token);
  if (error) console.warn('[push] device_tokens delete failed', error);
}

/**
 * Read-only permission probe. Never prompts — safe to call on mount.
 * Web has no native push surface here, so it reports 'unsupported'.
 */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';

  try {
    const { FirebaseMessaging } = await loadMessaging();
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === 'granted') return 'granted';
    if (receive === 'denied') return 'denied';
    return 'prompt';
  } catch (e) {
    console.warn('[push] checkPermissions failed', e);
    return 'unsupported';
  }
}

/**
 * No Capacitor plugin in this project can open the OS notification settings.
 * @capacitor/app is installed since batch 2A, but it has no API for this
 * (appInfo/state/backButton only), and @capacitor-firebase/messaging exposes no
 * openSettings() either. Covering this needs another plugin plus a native
 * rebuild, so for now this is a documented no-op and the UI shows manual
 * instructions instead.
 */
export async function openAppNotificationSettings(): Promise<void> {
  console.info('[push] openAppNotificationSettings: no plugin available, showing manual instructions');
}

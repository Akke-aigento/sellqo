import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

type NativePlatform = 'ios' | 'android';

export type PushPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

let currentUserId: string | null = null;
let listenersAttached = false;
let lastRegisteredToken: string | null = null;

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

async function upsertToken(userId: string, token: string, platform: NativePlatform) {
  if (lastRegisteredToken === token && currentUserId === userId) return;
  lastRegisteredToken = token;

  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        device_name: `${platform} device`,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

  if (error) {
    console.error('[push] device_tokens upsert failed', error);
  }
}

async function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const platform = Capacitor.getPlatform() as NativePlatform;
  const { FirebaseMessaging } = await loadMessaging();

  FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    if (!currentUserId || !token) return;
    void upsertToken(currentUserId, token, platform);
  });
}

export async function registerPushForUser(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  currentUserId = userId;
  await attachListeners();

  const { FirebaseMessaging } = await loadMessaging();

  const perm = await FirebaseMessaging.checkPermissions();
  let receive = perm.receive;
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    const requested = await FirebaseMessaging.requestPermissions();
    receive = requested.receive;
  }
  if (receive !== 'granted') return;

  const { token } = await FirebaseMessaging.getToken();
  if (token) {
    const platform = Capacitor.getPlatform() as NativePlatform;
    await upsertToken(userId, token, platform);
  }
}

export async function unregisterPushForUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const token = lastRegisteredToken;
  currentUserId = null;
  lastRegisteredToken = null;

  try {
    const { FirebaseMessaging } = await loadMessaging();
    await FirebaseMessaging.deleteToken();
  } catch (e) {
    console.warn('[push] FirebaseMessaging.deleteToken failed', e);
  }

  if (!token) return;
  const { error } = await supabase.from('device_tokens').delete().eq('token', token);
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
 * No Capacitor plugin in this project can open the OS notification settings
 * (@capacitor/app is not installed and @capacitor-firebase/messaging exposes no
 * openSettings()). Adding a plugin requires a native rebuild, so for now this
 * is a documented no-op and the UI shows manual instructions instead.
 */
export async function openAppNotificationSettings(): Promise<void> {
  console.info('[push] openAppNotificationSettings: no plugin available, showing manual instructions');
}

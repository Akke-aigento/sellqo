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

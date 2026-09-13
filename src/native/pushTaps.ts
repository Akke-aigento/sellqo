import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

/** Waar een aangetikte melding naartoe wil. */
export interface PushTapTarget {
  path: string;
  tenantId: string | null;
}

/**
 * Leest de bestemming uit de data van een pushmelding.
 *
 * `send-push-notification` stuurt `action_url` en `tenant_id` mee als
 * datavelden. Die werden tot 13 september 2026 nergens uitgelezen: een melding
 * aantikken opende de app op het scherm waar je toevallig was.
 *
 * Alleen interne admin-paden worden gevolgd. De data komt van onze eigen
 * server, maar een melding is een ingang van buiten de app, en een pad dat niet
 * met `/admin` begint — een volledige URL, een protocol-relatieve `//host` —
 * hoort hier nooit naar te leiden. Dezelfde houding als `deepLinkPath`.
 */
export function pushTapTarget(data: unknown): PushTapTarget | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  const actionUrl = typeof record.action_url === 'string' ? record.action_url : '';
  const isAdminPath = actionUrl === '/admin' || actionUrl.startsWith('/admin/');
  if (!isAdminPath) return null;

  const tenantId = typeof record.tenant_id === 'string' && record.tenant_id ? record.tenant_id : null;
  return { path: actionUrl, tenantId };
}

/**
 * Registreert de listener voor een aangetikte pushmelding.
 *
 * Zelfde opbouw als `initDeepLinks`: dynamische import zodat de Firebase-plugin
 * niet in de webbundel landt, een `cancelled`-vlag voor een unmount die vóór de
 * async registratie valt, en een cleanup.
 *
 * Een koude start gaat niet verloren. De plugin roept dit event aan met
 * `retainUntilConsumed` — op iOS en op Android, nagetrokken in de
 * pluginbron — dus wie de app opent door een melding aan te tikken, krijgt de
 * sprong ook als deze listener pas registreert zodra de admin geladen is.
 */
export function initPushNotificationTaps(onTap: (target: PushTapTarget) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let cancelled = false;
  let handle: PluginListenerHandle | null = null;

  const ready = (async () => {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      // Zie pushRegistration.ts: op Android is de plugin een Proxy die ook
      // `.then` doorstuurt, dus hem niet rechtstreeks uit een promise
      // teruggeven. Hier gebeurt dat niet — we roepen meteen addListener aan.
      const registered = await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const target = pushTapTarget(event.notification?.data);
        if (!target) {
          console.info('[push] aangetikt, geen admin-bestemming in de data');
          return;
        }
        onTap(target);
      });

      if (cancelled) {
        void registered.remove();
        return;
      }
      handle = registered;
    } catch (e) {
      console.warn('[push] tap-listener niet geregistreerd', e);
    }
  })();

  return () => {
    cancelled = true;
    void ready.then(() => handle?.remove());
  };
}

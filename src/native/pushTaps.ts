import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { notificationRoute } from '../../supabase/functions/_shared/notificationRoutes';

/** Waar een aangetikte melding naartoe wil. */
export interface PushTapTarget {
  path: string;
  tenantId: string | null;
}

/**
 * Leest de bestemming uit de data van een pushmelding.
 *
 * `send-push-notification` stuurt `action_url`, `category`, `type` en
 * `tenant_id` mee als datavelden. Sinds NOTIF-DEEPLINK-1 gaat het pad door
 * hetzelfde register als de bel (`notificationRoute`): een oud of kapot pad
 * uit een eerdere build van de server wordt zo alsnog de juiste pagina, en er
 * komt altijd een admin-pad uit — nooit een volledige URL of `//host`.
 *
 * `null` alleen als er niets bruikbaars in zit (geen tenant én geen type of pad).
 */
export function pushTapTarget(data: unknown): PushTapTarget | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const str = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : null);

  const tenantId = str('tenant_id') || null;
  if (!tenantId && !str('type') && !str('action_url')) return null;

  const path = notificationRoute({
    category: str('category'),
    type: str('type'),
    action_url: str('action_url'),
  });
  return { path, tenantId };
}

/** Wat de app met een aangetikte melding doet, gegeven de stand van de winkels. */
export type PushTapDecision =
  | { kind: 'wait' }
  | { kind: 'navigate'; path: string }
  | { kind: 'switch'; tenantId: string; path: string }
  | { kind: 'no-access' };

/**
 * NOTIF-DEEPLINK-1 — de beslissing, los van React zodat hij testbaar is.
 *
 * Tot 19 sep 2026 viel die meteen: bij een koude start levert de plugin het
 * bewaarde tap-event af vóór TenantProvider de winkels heeft geladen, dus
 * `tenants` was leeg, de winkel "onbekend" en de app ging naar het dashboard.
 * Nu: zolang de winkels laden → wachten.
 */
export function decidePushTap(
  target: PushTapTarget,
  state: { tenantsLoading: boolean; currentTenantId: string | null; tenantIds: readonly string[] },
): PushTapDecision {
  if (state.tenantsLoading) return { kind: 'wait' };
  if (!target.tenantId || target.tenantId === state.currentTenantId) {
    return { kind: 'navigate', path: target.path };
  }
  if (!state.tenantIds.includes(target.tenantId)) return { kind: 'no-access' };
  return { kind: 'switch', tenantId: target.tenantId, path: target.path };
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

import {
  FALLBACK_ROUTE,
  notificationRoute,
  type NotificationLike,
} from '../../supabase/functions/_shared/notificationRoutes';

/**
 * NOTIF-DEEPLINK-1 — de link achter een melding in de bel en op de
 * meldingenpagina: hetzelfde register als de pushmelding. `null` als er niets
 * beters is dan de meldingenlijst zelf — dan geen knop (geen dode affordance).
 */
export function notificationLink(n: NotificationLike): string | null {
  const route = notificationRoute(n);
  return route === FALLBACK_ROUTE ? null : route;
}

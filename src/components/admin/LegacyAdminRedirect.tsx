import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canonicalAdminPath } from '../../../supabase/functions/_shared/notificationRoutes';

/**
 * NOTIF-DEEPLINK-1 — oude admin-paden die in meldingen, e-mails en DB-triggers
 * staan (/admin/invoices…, /admin/quotes/:id, /admin/subscriptions,
 * /admin/products/:id, /admin/payouts, /admin/ai-center,
 * /admin/settings/billing) sturen door naar de pagina die wél bestaat. Zonder
 * dit landden ze op de kale 404 buiten de admin. Geen data-migratie nodig.
 */
export function LegacyAdminRedirect() {
  const { pathname, search } = useLocation();
  const target = canonicalAdminPath(`${pathname}${search}`);
  // Nooit naar zichzelf: dan liever de meldingenlijst dan een lus.
  const to = target && target !== `${pathname}${search}` ? target : '/admin/notifications';
  return <Navigate to={to} replace />;
}

/**
 * Zelfde, voor een oud patroon dat alleen in de query zit: `/admin/settings?tab=…`
 * (Settings leest alleen `?section=`) en `/admin/products?id=…` (de lijst negeert
 * `id`). Zonder die parameter rendert gewoon de pagina.
 */
export function LegacyQueryRedirect({ param, children }: { param: string; children: ReactNode }) {
  const { pathname, search } = useLocation();
  if (!new URLSearchParams(search).has(param)) return <>{children}</>;
  const target = canonicalAdminPath(`${pathname}${search}`);
  if (!target || target === `${pathname}${search}`) return <>{children}</>;
  return <Navigate to={target} replace />;
}

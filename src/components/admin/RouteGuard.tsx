import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCan, type Resource } from '@/hooks/useCan';
import { useAuth, type AppRole } from '@/hooks/useAuth';

interface RouteGuardProps {
  children: ReactNode;
  requireRead?: Resource;
  requireWrite?: Resource;
  requireRole?: AppRole[];
}

/**
 * H4a — page-level guard. Redirect naar `/no-access?from=...` als de
 * huidige rol de gevraagde permissie mist. `platform_admin` bypasst
 * altijd via `useCan`.
 */
export function RouteGuard({
  children,
  requireRead,
  requireWrite,
  requireRole,
}: RouteGuardProps) {
  const location = useLocation();
  const { loading, roles, isPlatformAdmin } = useAuth();

  // Hooks moeten onvoorwaardelijk gerund worden — geef een dummy resource
  // mee als er geen check nodig is en negeer het resultaat.
  const readResult = useCan('read', requireRead ?? 'orders');
  const writeResult = useCan('write', requireWrite ?? 'orders');
  const readOk = !requireRead || readResult;
  const writeOk = !requireWrite || writeResult;

  if (loading) return null;

  const roleOk = requireRole && requireRole.length > 0
    ? isPlatformAdmin ||
      (roles ?? []).some((r) => requireRole.includes(r.role as AppRole))
    : true;

  const allowed = readOk && writeOk && roleOk;
  if (!allowed) {
    const from = encodeURIComponent(location.pathname);
    return <Navigate to={`/no-access?from=${from}`} replace />;
  }

  return <>{children}</>;
}
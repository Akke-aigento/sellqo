import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCan, type Resource } from '@/hooks/useCan';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

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
  const { loading, rolesLoading, user, roles, isPlatformAdmin } = useAuth();

  // Hooks moeten onvoorwaardelijk gerund worden — geef een dummy resource
  // mee als er geen check nodig is en negeer het resultaat.
  const readResult = useCan('read', requireRead ?? 'orders');
  const writeResult = useCan('write', requireWrite ?? 'orders');
  const readOk = !requireRead || readResult;
  const writeOk = !requireWrite || writeResult;

  // Wait for both the auth session AND the initial user_roles fetch to
  // settle before deciding "no access". Without this we get a flash of
  // /no-access when returning to the app via an external redirect
  // (Stripe Connect onboarding return_url, hard refresh, deep-link).
  if (loading || (user && rolesLoading)) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
import { Navigate } from 'react-router-dom';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePlatformAdmin?: boolean;
  /**
   * Fase 2 Foundation — restrict route to users with at least one of the
   * given roles. `platform_admin` always passes. Empty/undefined = no role
   * restriction (only authentication is enforced).
   */
  requires?: AppRole[];
}

export function ProtectedRoute({
  children,
  requirePlatformAdmin = false,
  requires,
}: ProtectedRouteProps) {
  const { user, loading, isPlatformAdmin, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requirePlatformAdmin && !isPlatformAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (requires && requires.length > 0 && !isPlatformAdmin) {
    const userRoles = (roles ?? []).map((r) => r.role as AppRole);
    const hasRole = userRoles.some((r) => requires.includes(r));
    if (!hasRole) {
      return <Navigate to="/no-access" replace />;
    }
  }

  return <>{children}</>;
}

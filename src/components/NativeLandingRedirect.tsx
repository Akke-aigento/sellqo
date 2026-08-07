import { Capacitor } from '@capacitor/core';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import LandingPage from '@/pages/Landing';

/**
 * Route "/" wrapper: op web rendert dit gewoon de marketing-landing.
 * In de native Capacitor-app heeft een marketing-landing geen zin, dus
 * sturen we daar direct door naar /admin (ingelogd) of /auth (niet ingelogd).
 */
export default function NativeLandingRedirect() {
  const isNative = Capacitor.isNativePlatform();
  const { user, loading } = useAuth();

  if (!isNative) return <LandingPage />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={user ? '/admin' : '/auth'} replace />;
}
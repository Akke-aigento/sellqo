// KASSA-MOBIEL-1 — aanmelding van de kassa, los van beheer.
//
// De kassa leest haar sessie uit de kassa-client (eigen storageKey, zie kassaSupabase.ts). Een eigenaar-sessie
// komt hier nooit terecht: enkel koppelen (kassa-device-pair) of de eenmalige verhuis van een bestaande
// toestelsessie (legacySession.ts) zet hier een sessie. Beheer (useAuth) blijft daardoor ongemoeid: aangemeld
// blijven in beheer en een gekoppelde kassa gaan samen op één toestel, in één browser.
//
// Daarnaast:
//  - fouten uit de kassa logt clientErrors met de kassa-client (als het toestel);
//  - in de aparte Kassa-app (native, geen beheer) hoort het pushtoken bij de toestelaccount, zoals toen
//    AuthProvider dat voor de toestelsessie deed;
//  - SupabaseScopeProvider: gedeelde hooks (zaalplan, keukenbord, posten, printers, meldingen) gebruiken de
//    kassa-client.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useOptionalAuth } from '@/hooks/useAuth';
import { setErrorReportClient } from '@/lib/clientErrors';
import { SupabaseScopeProvider, type PushIdentity } from '@/lib/supabaseScope';
import { registerPushForUser } from '@/native/pushRegistration';
import { KASSA_AUTH_STORAGE_KEY, kassaSupabase } from '@/kassa/app/kassaSupabase';
import { KASSA_PUSH_SCOPE, moveLegacySessionOnce } from './legacySession';

interface KassaAuthValue {
  user: User | null;
  loading: boolean;
  /** Enkel de kassa-sessie op dit toestel weg (beheer blijft aangemeld). */
  signOut: () => Promise<void>;
}

const KassaAuthContext = createContext<KassaAuthValue | null>(null);

/** Opgeslagen kassa-sessie lezen zonder netwerk (offline opstarten: de gebruiker blijft gekend). */
function storedUser(): User | null {
  try {
    const raw = window.localStorage.getItem(KASSA_AUTH_STORAGE_KEY);
    return raw ? ((JSON.parse(raw) as { user?: User } | null)?.user ?? null) : null;
  } catch {
    return null;
  }
}

export function KassaAuthProvider({ standalone, children }: { standalone: boolean; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const beheer = useOptionalAuth();

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;
    setErrorReportClient(kassaSupabase);
    const keep = (next: User | null) => setUser((prev) => (prev && next && prev.id === next.id ? prev : next));
    void (async () => {
      await moveLegacySessionOnce();
      const { data, error } = await kassaSupabase.auth.getSession();
      if (!alive) return;
      // Offline of server onbereikbaar: de opgeslagen toestelsessie blijft gelden (de kassa start met de bewaarde
      // context, zie deviceAccount.fetchDeviceContext); autoRefresh probeert het later opnieuw.
      keep(data.session?.user ?? (error ? storedUser() : null));
      setLoading(false);
      const { data: sub } = kassaSupabase.auth.onAuthStateChange((_event, session) => {
        if (!alive) return;
        keep(session?.user ?? null);
        setLoading(false);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();
    return () => {
      alive = false;
      unsubscribe?.();
      setErrorReportClient(null);
    };
  }, []);

  // Aparte Kassa-app (native): het pushtoken van deze installatie hoort bij de toestelaccount.
  useEffect(() => {
    if (!standalone || !user || !Capacitor.isNativePlatform()) return;
    registerPushForUser(user.id, kassaSupabase).catch((err) => console.error('[push] kassa registration failed', err));
  }, [standalone, user]);

  const value = useMemo<KassaAuthValue>(() => ({
    user,
    loading,
    signOut: async () => {
      try { await kassaSupabase.auth.signOut({ scope: 'local' }); } catch { /* offline: lokaal toch weg */ }
      setUser(null);
    },
  }), [user, loading]);

  // Push: in de SellQo-app (native, met beheer) is er één token per installatie; dat blijft bij beheer zolang daar
  // iemand aangemeld is (anders zouden kassa en beheer het om beurten van elkaar overnemen). Op het web heeft de
  // kassa een eigen abonnement (scope /kassa/), in de aparte Kassa-app is er geen beheer.
  const beheerUserId = beheer?.user?.id ?? null;
  const push = useMemo<PushIdentity>(() => (
    Capacitor.isNativePlatform() && !standalone && beheerUserId
      ? { db: supabase, userId: beheerUserId }
      : { db: kassaSupabase, userId: user?.id ?? null, scope: KASSA_PUSH_SCOPE }
  ), [standalone, beheerUserId, user?.id]);

  return (
    <KassaAuthContext.Provider value={value}>
      <SupabaseScopeProvider client={kassaSupabase} userId={user?.id ?? null} push={push}>
        {children}
      </SupabaseScopeProvider>
    </KassaAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKassaAuth(): KassaAuthValue {
  const ctx = useContext(KassaAuthContext);
  if (!ctx) throw new Error('useKassaAuth hoort binnen KassaAuthProvider');
  return ctx;
}

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { registerPushForUser, unregisterPushForUser } from '@/native/pushRegistration';
import { LogoLoader } from '@/components/LogoLoader';

// Storage key used by Supabase auth
const SUPABASE_AUTH_KEY = 'sb-gczmfcabnoofnmfpzeop-auth-token';

/**
 * Detects if there's stale auth data in localStorage without a valid session.
 * This happens when tokens expire or get corrupted.
 */
/**
 * Is dit een hapering in het netwerk, of deugt de sessie echt niet?
 *
 * Dat onderscheid ontbrak, en het was destructief. `initializeAuth` wiste de
 * opgeslagen sessie bij élke fout van `getSession()`, en `hasStaleAuthStorage()`
 * is niet meer dan "staat er iets in localStorage" — dus altijd waar als je
 * ingelogd was. Een netwerkfout telde daardoor als corrupte opslag: de app
 * openen in een tunnel, in een vliegtuig of met haperende wifi logde je uit en
 * je moest opnieuw je wachtwoord intypen.
 *
 * Dat viel extra op in de app, waar je niet even ververst. Server-side is er
 * niets aan de hand: sessies hebben geen `not_after` en geen inactiviteitslimiet
 * (nagetrokken 12 sep 2026 — er stond een sessie van 58 dagen ongebruikt die nog
 * gewoon geldig was). Wie de app één keer per maand opent hoort ingelogd te
 * blijven; het weggooien gebeurde aan onze kant.
 *
 * We wissen nu alleen bij een definitief antwoord van de server. Dat maakt niets
 * ruimer: een ingetrokken of verlopen refresh-token geeft een 4xx en daar loggen
 * we nog steeds op uit, en een ongeldig token wordt sowieso door RLS en de edge
 * functions geweigerd.
 */
function isTransientAuthError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  // supabase-js heeft hier een eigen type voor.
  if (name === 'AuthRetryableFetchError') return true;
  const status = (error as { status?: number } | null)?.status ?? 0;
  // 0 = geen verbinding; 5xx = de server, niet jouw sessie.
  if (status === 0 || status >= 500) return true;
  const message = (error as { message?: string } | null)?.message ?? '';
  return /failed to fetch|network|load failed|timeout|aborted/i.test(message);
}

function hasStaleAuthStorage(): boolean {
  try {
    const stored = localStorage.getItem(SUPABASE_AUTH_KEY);
    return stored !== null && stored !== '';
  } catch {
    return false;
  }
}

/**
 * Force clears all auth storage to allow clean re-login.
 */
function clearAuthStorage(): void {
  try {
    localStorage.removeItem(SUPABASE_AUTH_KEY);
  } catch (e) {
    console.warn('Failed to clear auth storage:', e);
  }
}

/**
 * Opruimen mag NOOIT de sessies van andere tabs of apparaten slopen.
 * `signOut()` is standaard `scope: 'global'` en revoket alles server-side;
 * dat maakte tokens in andere tabs tot zombies (RLS werkt nog, maar
 * GoTrue geeft session_not_found → alle edge functions 401).
 * Daarom altijd expliciet `scope: 'local'`, en fouten mogen de opruiming
 * nooit blokkeren.
 */
async function safeLocalSignOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('[Auth] local signOut failed (genegeerd):', e);
  }
  clearAuthStorage();
}


/**
 * Hoe lang het afmelden van pushberichten het uitloggen mag ophouden.
 * Lukt het niet binnen deze tijd, dan gaat het uitloggen door — een gebruiker
 * die weg wil, moet weg kunnen.
 */
const PUSH_UNREGISTER_TIMEOUT_MS = 3000;

export type AppRole = 'platform_admin' | 'tenant_admin' | 'accountant' | 'staff' | 'warehouse' | 'viewer' | 'marketing';

// Role priority for determining highest role
const ROLE_PRIORITY: Record<AppRole, number> = {
  platform_admin: 1,
  tenant_admin: 2,
  accountant: 3,
  staff: 4,
  warehouse: 5,
  marketing: 5,
  viewer: 6,
};

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /**
   * True until the initial user_roles fetch resolves after sign-in /
   * session restore. RouteGuard / useCan must wait for this before
   * deciding "no access", otherwise authenticated users see a flash of
   * /no-access while roles are still loading (e.g. when returning from
   * Stripe Connect onboarding via return_url).
   */
  rolesLoading: boolean;
  roles: UserRole[];
  isPlatformAdmin: boolean;
  userRole: AppRole | null;
  isWarehouse: boolean;
  isAccountant: boolean;
  hasFinancialAccess: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /**
   * Verstuurt een reset-mail via GoTrue. `redirectTo` is bewust dynamisch
   * (window.location.origin) zodat tenants op custom domains niet naar de
   * platform-URL gestuurd worden.
   */
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  /**
   * Ensures the user has a valid authenticated session.
   * Returns true if authenticated, false if session is invalid/expired.
   * If session is invalid, it will attempt to refresh, then force sign-out if that fails.
   */
  ensureAuthenticated: () => Promise<boolean>;
  /**
   * Gets a verified access token, optionally forcing a refresh first.
   * Use this for critical database writes where you need to guarantee
   * the Authorization header is present.
   */
  getVerifiedAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  /**
   * Force-refetches user_roles from the database and updates context state.
   * Used after server-side INSERTs into user_roles (e.g. invite-accept) so
   * `useCan` reflects the new permissions without a page-refresh.
   *
   * ONBOARD-REMOUNT-1 — met `{ silent: true }` blijft `rolesLoading` ongemoeid,
   * zodat `ProtectedRoute` de admin-boom niet unmount tijdens de refetch.
   */
  refetchRoles: (opts?: { silent?: boolean }) => Promise<UserRole[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const { toast } = useToast();

  /**
   * AUTH-REFRESH-1 — event-discriminatie voor `onAuthStateChange`.
   *
   * GoTrue vuurt bij terugkeer naar de tab (bv. na tab-switch of laptop-
   * ontwaken) een `TOKEN_REFRESHED`/`SIGNED_IN` event met een verse
   * `access_token`. We willen dan uitsluitend `session` bijwerken, en
   * NIET `user` opnieuw setten of `rolesLoading` op true zetten — dat
   * zou de RouteGuard laten unmounten en form-state weggooien.
   *
   * Alleen bij een écht andere user (login / user-switch) draaien we de
   * volledige flow. `hasResolvedRolesOnceRef` zorgt dat `rolesLoading`
   * na de eerste succesvolle fetch niet meer terug naar true springt
   * voor achtergrond-refetches; `refetchRoles()` (invite-accept) heeft
   * daar zijn eigen pad naast.
   */
  const currentUserIdRef = useRef<string | null>(null);
  const hasResolvedRolesOnceRef = useRef(false);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }

    return (data || []) as UserRole[];
  };

  const refetchRoles = useCallback(async (
    opts?: { silent?: boolean }
  ): Promise<UserRole[]> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setRoles([]);
      setRolesLoading(false);
      return [];
    }
    // refetchRoles() is bewust luid — invite-accept verwacht dat de
    // guard even wacht. Andere paden gebruiken deze functie niet.
    // ONBOARD-REMOUNT-1 — behalve met { silent: true }: dan slaan we de
    // rolesLoading-flip over, want die laat ProtectedRoute de hele admin-boom
    // (AdminLayout → TenantProvider + OnboardingWizard) unmounten, waardoor
    // in-memory refs en pending state van de onboarding-wizard verdwijnen.
    if (!opts?.silent) setRolesLoading(true);
    const fresh = await fetchUserRoles(currentUser.id);
    setRoles(fresh);
    if (!opts?.silent) setRolesLoading(false);
    hasResolvedRolesOnceRef.current = true;
    return fresh;
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[Auth] State change:', event, currentSession?.user?.email);
        
        // Handle sign out events - also clear any stale storage
        if (event === 'SIGNED_OUT') {
          void unregisterPushForUser();
          clearAuthStorage();
          setSession(null);
          setUser(null);
          setRoles([]);
          setRolesLoading(false);
          setLoading(false);
          currentUserIdRef.current = null;
          hasResolvedRolesOnceRef.current = false;
          return;
        }
        
        // If we get a session, use it
        if (currentSession?.user) {
          const incomingId = currentSession.user.id;
          const sameUser =
            currentUserIdRef.current !== null &&
            currentUserIdRef.current === incomingId;

          if (sameUser && hasResolvedRolesOnceRef.current) {
            // Verse access_token bij tab-switch / token-refresh. Alleen
            // de sessie bijwerken — user-object en roles blijven staan
            // zodat downstream effects niet hervuren en RouteGuard niet
            // unmount.
            setSession(currentSession);
            setLoading(false);
            return;
          }

          // Echte nieuwe login of user-switch: volledige flow.
          setSession(currentSession);
          setUser((prev) =>
            prev && prev.id === currentSession.user.id ? prev : currentSession.user
          );
          currentUserIdRef.current = incomingId;
          registerPushForUser(incomingId).catch((err) =>
            console.error('[push] registration failed', err),
          );
          // Alleen bij initiële load de guard triggeren; latere refetches
          // lopen op de achtergrond.
          if (!hasResolvedRolesOnceRef.current) {
            setRolesLoading(true);
          }
          setTimeout(() => {
            fetchUserRoles(currentSession.user.id).then((r) => {
              setRoles(r);
              setRolesLoading(false);
              hasResolvedRolesOnceRef.current = true;
            });
          }, 0);
        } else if (hasStaleAuthStorage()) {
          // AUTH-DEADLOCK-1 — nooit een auth-call awaiten binnen deze
          // callback: supabase-js houdt hier het auth-lock (navigator.locks)
          // vast, dus refreshSession/signOut hierbinnen deadlockt tot timeout
          // ("AbortError: signal is aborted without reason"). Defer het
          // herstelpad, net zoals het fetchUserRoles-pad hierboven.
          setTimeout(() => { void handleStaleStorage(); }, 0);
          return;
        } else {
          setSession(null);
          setUser(null);
          setRoles([]);
          setRolesLoading(false);
          currentUserIdRef.current = null;
        }
        
        setLoading(false);
      }
    );

    // Stale-storage-herstel, bewust buiten de auth-lock-context uitgevoerd.
    async function handleStaleStorage() {
      // No session but storage exists. Kan een tijdelijke race zijn
      // (bv. GoTrue vuurt event vlak vóór session-hydration). Probeer
      // eerst een refresh; alleen bij échte fout alsnog uitloggen.
      console.warn('[Auth] Stale auth storage detected, attempting refresh before sign-out...');
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session?.user) {
        const refreshed = refreshData.session;
        const incomingId = refreshed.user.id;
        const sameUser =
          currentUserIdRef.current !== null &&
          currentUserIdRef.current === incomingId;
        setSession(refreshed);
        if (sameUser && hasResolvedRolesOnceRef.current) {
          // Alleen sessie bijwerken.
        } else {
          setUser((prev) =>
            prev && prev.id === refreshed.user.id ? prev : refreshed.user
          );
          currentUserIdRef.current = incomingId;
          registerPushForUser(incomingId).catch((err) =>
            console.error('[push] registration failed', err),
          );
          if (!hasResolvedRolesOnceRef.current) {
            setRolesLoading(true);
          }
          setTimeout(() => {
            fetchUserRoles(refreshed.user.id).then((r) => {
              setRoles(r);
              setRolesLoading(false);
              hasResolvedRolesOnceRef.current = true;
            });
          }, 0);
        }
      } else if (isTransientAuthError(refreshError)) {
        // Zie isTransientAuthError: bij een netwerkhapering laten we de sessie
        // staan. autoRefreshToken probeert het vanzelf opnieuw.
        console.warn('[Auth] Refresh mislukt door een tijdelijke fout — sessie blijft staan.', refreshError);
      } else {
        console.warn('[Auth] Refresh failed, cleaning up storage.', refreshError);
        await safeLocalSignOut();
        setSession(null);

        setUser(null);
        setRoles([]);
        setRolesLoading(false);
        currentUserIdRef.current = null;
        hasResolvedRolesOnceRef.current = false;
      }

      setLoading(false);
    }

    // THEN check for existing session with defensive cleanup
    const initializeAuth = async (retried = false): Promise<void> => {
      const { data: { session: existingSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Auth] Error getting session:', error);

        // Een hapering is geen reden om iemand uit te loggen. Eén herkansing na
        // anderhalve seconde vangt de meest voorkomende situatie af: de app
        // start op terwijl de verbinding nog niet staat.
        if (isTransientAuthError(error)) {
          console.warn('[Auth] Tijdelijke fout bij getSession — sessie blijft staan, één herkansing.');
          if (!retried) {
            await new Promise((r) => setTimeout(r, 1500));
            return initializeAuth(true);
          }
          setRolesLoading(false);
          setLoading(false);
          return;
        }

        // Clear corrupt storage if session fetch fails
        if (hasStaleAuthStorage()) {
          console.warn('[Auth] Session error with stale storage, cleaning up...');
          await safeLocalSignOut();
        }

        setSession(null);
        setUser(null);
        setRoles([]);
        setRolesLoading(false);
        setLoading(false);
        return;
      }
      
      if (existingSession?.user) {
        setSession(existingSession);
        setUser((prev) =>
          prev && prev.id === existingSession.user.id ? prev : existingSession.user
        );
        currentUserIdRef.current = existingSession.user.id;
        registerPushForUser(existingSession.user.id).catch((err) =>
          console.error('[push] registration failed', err),
        );
        if (!hasResolvedRolesOnceRef.current) {
          setRolesLoading(true);
        }
        fetchUserRoles(existingSession.user.id).then((r) => {
          setRoles(r);
          setRolesLoading(false);
          hasResolvedRolesOnceRef.current = true;
        });
      } else if (hasStaleAuthStorage()) {
        // No session but we have storage = corrupt state
        console.warn('[Auth] No session but stale storage exists, cleaning up...');
        await safeLocalSignOut();
        setRolesLoading(false);

      } else {
        setRolesLoading(false);
      }
      
      setLoading(false);
    };
    
    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Ensures the user has a valid, non-expired session.
   * Now includes server-side validation via getUser() to guarantee the token works.
   * Attempts to refresh if needed, forces sign-out on failure.
   */
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    console.log('[Auth] ensureAuthenticated: checking session...');
    
    // First, get current session state
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Auth] ensureAuthenticated: session error', sessionError);
      await safeLocalSignOut();
      return false;
    }

    
    // If we have a session, verify it's actually valid server-side
    if (currentSession?.user && currentSession.access_token) {
      console.log('[Auth] ensureAuthenticated: session exists, verifying with server...');
      
      // getUser() makes a server call to verify the token
      const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !verifiedUser) {
        console.warn('[Auth] ensureAuthenticated: server rejected token, attempting refresh...', userError);
        
        // Token is stale, try to refresh
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('[Auth] ensureAuthenticated: refresh also failed', refreshError);
          await safeLocalSignOut();
          toast({

            title: t('auth.sessionExpired.title'),
            description: t('auth.sessionExpired.short'),
            variant: 'destructive',
          });
          return false;
        }
        
        console.log('[Auth] ensureAuthenticated: refresh succeeded after server rejection');
        return true;
      }
      
      console.log('[Auth] ensureAuthenticated: server verified session for', verifiedUser.email);
      return true;
    }
    
    // No session - try to refresh if we have storage (might be expired)
    if (hasStaleAuthStorage()) {
      console.log('[Auth] ensureAuthenticated: no session but storage exists, attempting refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.warn('[Auth] ensureAuthenticated: refresh failed, forcing sign-out', refreshError);
        await safeLocalSignOut();
        toast({

          title: t('auth.sessionExpired.title'),
          description: t('auth.sessionExpired.short'),
          variant: 'destructive',
        });
        return false;
      }
      
      console.log('[Auth] ensureAuthenticated: refresh succeeded');
      return true;
    }
    
    // No session and no storage = not authenticated
    console.log('[Auth] ensureAuthenticated: no session found');
    return false;
  }, [toast, t]);

  /**
   * Gets a verified access token, optionally forcing a refresh first.
   * Returns null if no valid token can be obtained.
   * 
   * Use this for critical database writes where you need to guarantee
   * the Authorization header is present.
   */
  const getVerifiedAccessToken = useCallback(async (options?: { forceRefresh?: boolean }): Promise<string | null> => {
    console.log('[Auth] getVerifiedAccessToken: starting...', options);
    
    // Optionally force a refresh first
    if (options?.forceRefresh) {
      console.log('[Auth] getVerifiedAccessToken: forcing token refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.warn('[Auth] getVerifiedAccessToken: refresh failed', refreshError);
        // Don't return null yet - try getSession as fallback
      } else if (refreshData.session?.access_token) {
        // Verify the refreshed token works
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
        if (verifiedUser && !userError) {
          console.log('[Auth] getVerifiedAccessToken: refresh succeeded, token verified');
          return refreshData.session.access_token;
        }
      }
    }
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.warn('[Auth] getVerifiedAccessToken: no session available');
      return null;
    }
    
    // Verify the token works server-side
    const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !verifiedUser) {
      console.warn('[Auth] getVerifiedAccessToken: token rejected by server', userError);
      
      // Last attempt: refresh and try again
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData.session?.access_token) {
        const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
        if (retryUser && !retryError) {
          console.log('[Auth] getVerifiedAccessToken: got valid token after emergency refresh');
          return refreshData.session.access_token;
        }
      }
      
      return null;
    }
    
    console.log('[Auth] getVerifiedAccessToken: returning verified token for', verifiedUser.email);
    return session.access_token;
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: t('auth.toast.loginFailed'),
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: t('auth.welcomeBack'),
      description: t('auth.toast.loginSuccess'),
    });

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      toast({
        title: t('auth.toast.signupFailed'),
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: t('auth.toast.signupSuccess'),
      description: t('auth.toast.signupSuccessBody'),
    });

    return { error: null };
  };

  const signOut = async () => {
    // Meteen zichtbaar maken dat er iets gebeurt. Hiervóór bleef het scherm
    // ongeveer een seconde onveranderd staan: pas ná `unregisterPushForUser`
    // en `safeLocalSignOut` veranderde de auth-state en verhuisde de route.
    // In de native app is dat merkbaar — daar doet de eerste een Firebase-call
    // plús een DB-delete — en een knop die niets lijkt te doen nodigt uit tot
    // nog eens tikken.
    setSigningOut(true);
    try {
      // Volgorde is wél belangrijk en blijft zoals hij was. De delete op
      // `device_tokens` heeft de sessie nodig; draaien we die ná het uitloggen,
      // dan loopt hij als `anon` tegen RLS aan en blijft de tokenrij staan.
      // Het toestel krijgt dan pushberichten voor een uitgelogde gebruiker, en
      // dat is een groter probleem dan een seconde wachten.
      //
      // Wel begrensd: een hangende Firebase-call mag het uitloggen niet
      // tegenhouden. De functie logt zelf al een waarschuwing als hij faalt.
      await Promise.race([
        unregisterPushForUser(),
        new Promise<void>((resolve) => setTimeout(resolve, PUSH_UNREGISTER_TIMEOUT_MS)),
      ]);
      await safeLocalSignOut();
      setRoles([]);
      currentUserIdRef.current = null;
      hasResolvedRolesOnceRef.current = false;
      toast({
        title: t('auth.toast.loggedOut'),
        description: t('auth.toast.loggedOutBody'),
      });
    } finally {
      setSigningOut(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };


  const isPlatformAdmin = roles.some(r => r.role === 'platform_admin');
  
  // Calculate highest priority role
  const userRole = roles.length > 0
    ? roles.reduce((highest, r) => {
        const currentPriority = ROLE_PRIORITY[r.role] || 99;
        const highestPriority = ROLE_PRIORITY[highest] || 99;
        return currentPriority < highestPriority ? r.role : highest;
      }, roles[0].role as AppRole)
    : null;

  const isWarehouse = userRole === 'warehouse';
  const isAccountant = userRole === 'accountant';
  const hasFinancialAccess = ['platform_admin', 'tenant_admin', 'accountant'].includes(userRole || '');

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      rolesLoading,
      roles,
      isPlatformAdmin,
      userRole,
      isWarehouse,
      isAccountant,
      hasFinancialAccess,
      signIn,
      signUp,
      signOut,
      resetPassword,
      ensureAuthenticated,
      getVerifiedAccessToken,
      refetchRoles,
    }),
    [
      user,
      session,
      loading,
      rolesLoading,
      roles,
      isPlatformAdmin,
      userRole,
      isWarehouse,
      isAccountant,
      hasFinancialAccess,
      ensureAuthenticated,
      getVerifiedAccessToken,
      refetchRoles,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {/*
        Uitloggen duurt even — het afmelden van pushberichten moet vóór het
        wissen van de sessie. Deze laag maakt dat zichtbaar in plaats van het
        scherm onveranderd te laten staan. Hij hangt hier, niet bij de losse
        uitlogknoppen, zodat elk uitlogpad hem krijgt: de zijbalk, de
        trial-blokkade, de onboarding en het keuzescherm.
      */}
      {signingOut && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm">
          <LogoLoader />
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

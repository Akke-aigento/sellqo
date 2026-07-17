import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Storage key used by Supabase auth
const SUPABASE_AUTH_KEY = 'sb-gczmfcabnoofnmfpzeop-auth-token';

/**
 * Detects if there's stale auth data in localStorage without a valid session.
 * This happens when tokens expire or get corrupted.
 */
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
   */
  refetchRoles: () => Promise<UserRole[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
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

  const refetchRoles = useCallback(async (): Promise<UserRole[]> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setRoles([]);
      setRolesLoading(false);
      return [];
    }
    // refetchRoles() is bewust luid — invite-accept verwacht dat de
    // guard even wacht. Andere paden gebruiken deze functie niet.
    setRolesLoading(true);
    const fresh = await fetchUserRoles(currentUser.id);
    setRoles(fresh);
    setRolesLoading(false);
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

    // THEN check for existing session with defensive cleanup
    const initializeAuth = async () => {
      const { data: { session: existingSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Auth] Error getting session:', error);
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

            title: 'Sessie verlopen',
            description: 'Log opnieuw in om verder te gaan.',
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

          title: 'Sessie verlopen',
          description: 'Log opnieuw in om verder te gaan.',
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
  }, [toast]);

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
        title: 'Login mislukt',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: 'Welkom terug!',
      description: 'Je bent succesvol ingelogd.',
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
        title: 'Registratie mislukt',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: 'Account aangemaakt!',
      description: 'Je kunt nu inloggen.',
    });

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    currentUserIdRef.current = null;
    hasResolvedRolesOnceRef.current = false;
    toast({
      title: 'Uitgelogd',
      description: 'Tot ziens!',
    });
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

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

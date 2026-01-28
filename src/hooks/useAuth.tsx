import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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

export type AppRole = 'platform_admin' | 'tenant_admin' | 'accountant' | 'staff' | 'warehouse' | 'viewer';

// Role priority for determining highest role
const ROLE_PRIORITY: Record<AppRole, number> = {
  platform_admin: 1,
  tenant_admin: 2,
  accountant: 3,
  staff: 4,
  warehouse: 5,
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const { toast } = useToast();

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
          setLoading(false);
          return;
        }
        
        // If we get a session, use it
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setTimeout(() => {
            fetchUserRoles(currentSession.user.id).then(setRoles);
          }, 0);
        } else if (hasStaleAuthStorage()) {
          // No session but storage exists = corrupt/expired state
          console.warn('[Auth] Stale auth storage detected, cleaning up...');
          clearAuthStorage();
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setRoles([]);
        } else {
          setSession(null);
          setUser(null);
          setRoles([]);
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
          clearAuthStorage();
          await supabase.auth.signOut();
        }
        setSession(null);
        setUser(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      
      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);
        fetchUserRoles(existingSession.user.id).then(setRoles);
      } else if (hasStaleAuthStorage()) {
        // No session but we have storage = corrupt state
        console.warn('[Auth] No session but stale storage exists, cleaning up...');
        clearAuthStorage();
        await supabase.auth.signOut();
      }
      
      setLoading(false);
    };
    
    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Ensures the user has a valid, non-expired session.
   * Attempts to refresh if needed, forces sign-out on failure.
   */
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    console.log('[Auth] ensureAuthenticated: checking session...');
    
    // First, get current session state
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Auth] ensureAuthenticated: session error', sessionError);
      clearAuthStorage();
      await supabase.auth.signOut();
      return false;
    }
    
    // If we have a valid session with a user, we're good
    if (currentSession?.user && currentSession.access_token) {
      console.log('[Auth] ensureAuthenticated: valid session for', currentSession.user.email);
      return true;
    }
    
    // No session - try to refresh if we have storage (might be expired)
    if (hasStaleAuthStorage()) {
      console.log('[Auth] ensureAuthenticated: attempting session refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.warn('[Auth] ensureAuthenticated: refresh failed, forcing sign-out', refreshError);
        clearAuthStorage();
        await supabase.auth.signOut();
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
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
      }}
    >
      {children}
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

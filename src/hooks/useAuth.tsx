import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id).then(setRoles);
          }, 0);
        } else {
          setRoles([]);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoles(session.user.id).then(setRoles);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';

export interface StorefrontCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  addresses?: StorefrontAddress[];
}

export interface StorefrontAddress {
  id: string;
  label?: string;
  first_name?: string;
  last_name?: string;
  street: string;
  house_number?: string;
  postal_code: string;
  city: string;
  country: string;
  phone?: string;
  is_default?: boolean;
}

interface StorefrontAuthContextType {
  customer: StorefrontCustomer | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { email: string; password: string; first_name: string; last_name: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<Pick<StorefrontCustomer, 'first_name' | 'last_name' | 'phone'>>) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  tenantId: string | undefined;
}

const StorefrontAuthContext = createContext<StorefrontAuthContextType | undefined>(undefined);

const TOKEN_KEY_PREFIX = 'storefront_token_';

export function StorefrontAuthProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const tenantId = tenant?.id;

  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const storageKey = `${TOKEN_KEY_PREFIX}${tenantSlug}`;

  // Invoke the storefront-customer-api edge function
  const invokeApi = useCallback(async (action: string, params: Record<string, unknown> = {}, authToken?: string) => {
    if (!tenantId) throw new Error('Tenant not loaded');
    const headers: Record<string, string> = {};
    const tkn = authToken || token;
    if (tkn) headers['x-storefront-token'] = tkn;

    const { data, error } = await supabase.functions.invoke('storefront-customer-api', {
      body: { action, tenant_id: tenantId, params },
      headers,
    });
    if (error) throw new Error(error.message || 'API error');
    if (data && !data.success) throw new Error(data.error || 'Unknown error');
    return data?.data;
  }, [tenantId, token]);

  // Validate token on mount
  useEffect(() => {
    if (!tenantId || !tenantSlug) { setLoading(false); return; }
    const stored = localStorage.getItem(storageKey);
    if (!stored) { setLoading(false); return; }

    setToken(stored);
    // Validate by fetching profile
    (async () => {
      try {
        const profile = await invokeApiDirect('get_profile', {}, stored);
        setCustomer(profile);
      } catch {
        localStorage.removeItem(storageKey);
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, tenantSlug]);

  // Direct invoke without relying on state token (for init)
  const invokeApiDirect = useCallback(async (action: string, params: Record<string, unknown>, authToken: string) => {
    if (!tenantId) throw new Error('Tenant not loaded');
    const { data, error } = await supabase.functions.invoke('storefront-customer-api', {
      body: { action, tenant_id: tenantId, params },
      headers: { 'x-storefront-token': authToken },
    });
    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Unknown error');
    return data?.data;
  }, [tenantId]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await invokeApi('login', { email, password });
      setToken(result.token);
      setCustomer(result.customer);
      localStorage.setItem(storageKey, result.token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login mislukt' };
    }
  }, [invokeApi, storageKey]);

  const register = useCallback(async (data: { email: string; password: string; first_name: string; last_name: string; phone?: string }) => {
    try {
      const result = await invokeApi('register', data);
      // New flow: if requires_verification, don't set token — user must verify email first
      if (result?.requires_verification) {
        return { success: true, requiresVerification: true };
      }
      // Fallback for legacy behavior
      if (result?.token) {
        setToken(result.token);
        setCustomer(result.customer);
        localStorage.setItem(storageKey, result.token);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registratie mislukt' };
    }
  }, [invokeApi, storageKey]);

  const logout = useCallback(() => {
    setToken(null);
    setCustomer(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const updateProfile = useCallback(async (data: Partial<Pick<StorefrontCustomer, 'first_name' | 'last_name' | 'phone'>>) => {
    try {
      const result = await invokeApi('update_profile', data);
      setCustomer(prev => prev ? { ...prev, ...result } : prev);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [invokeApi]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const profile = await invokeApi('get_profile');
      setCustomer(profile);
    } catch { /* ignore */ }
  }, [invokeApi, token]);

  return (
    <StorefrontAuthContext.Provider value={{
      customer, token, isAuthenticated: !!customer, loading,
      login, register, logout, updateProfile, refreshProfile, tenantId,
    }}>
      {children}
    </StorefrontAuthContext.Provider>
  );
}

export function useStorefrontAuth() {
  const context = useContext(StorefrontAuthContext);
  if (!context) throw new Error('useStorefrontAuth must be used within StorefrontAuthProvider');
  return context;
}

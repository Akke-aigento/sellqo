import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  owner_email: string;
  owner_name: string | null;
  phone: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  kvk_number: string | null;
  btw_number: string | null;
  subscription_status: string;
  subscription_plan: string;
  currency: string;
  shipping_enabled: boolean;
  tax_percentage: number;
  created_at: string;
  updated_at: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  setCurrentTenant: (tenant: Tenant | null) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, roles, loading: authLoading } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching tenants:', error);
      setTenants([]);
    } else {
      setTenants(data || []);
      
      // Auto-select first tenant if none selected
      if (!currentTenant && data && data.length > 0) {
        setCurrentTenant(data[0]);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchTenants();
    } else if (!authLoading && !user) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
    }
  }, [user, authLoading, roles]);

  const refreshTenants = async () => {
    await fetchTenants();
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenants,
        loading,
        setCurrentTenant,
        refreshTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

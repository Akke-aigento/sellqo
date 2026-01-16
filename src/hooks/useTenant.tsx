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
  // Peppol
  peppol_id?: string | null;
  // Invoice settings
  invoice_prefix?: string | null;
  invoice_start_number?: number | null;
  invoice_format?: string | null;
  iban?: string | null;
  bic?: string | null;
  auto_send_invoices?: boolean;
  // Credit note settings
  credit_note_prefix?: string | null;
  credit_note_start_number?: number | null;
  // OSS settings
  apply_oss_rules?: boolean;
  oss_registration_date?: string | null;
  oss_identification_number?: string | null;
  // VAT settings
  require_vies_validation?: boolean;
  block_invalid_vat_orders?: boolean;
  default_vat_handling?: string | null;
  reverse_charge_text?: string | null;
  export_text?: string | null;
  // Reminder settings
  reminders_enabled?: boolean;
  reminder_level1_days?: number;
  reminder_level2_days?: number;
  reminder_level3_days?: number;
  reminder_late_fee_enabled?: boolean;
  reminder_late_fee_percentage?: number;
  // Pro-forma settings
  proforma_prefix?: string | null;
  proforma_start_number?: number | null;
  proforma_validity_days?: number;
  // Packing slip settings
  packing_slip_prefix?: string | null;
  packing_slip_start_number?: number | null;
  // Stripe
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  stripe_onboarding_complete?: boolean;
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

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
  // Billing details (can differ from owner/login)
  billing_email?: string | null;
  billing_company_name?: string | null;
  // Demo and internal flags
  is_demo?: boolean;
  is_internal_tenant?: boolean;
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
  // VAT flexibility settings
  enable_b2b_checkout?: boolean;
  simplified_vat_mode?: boolean;
  simplified_vat_acknowledged_at?: string | null;
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
  // Domain
  custom_domain?: string | null;
  domain_verified?: boolean;
  domain_verification_token?: string | null;
  // WhatsApp settings
  whatsapp_enabled?: boolean;
  whatsapp_order_confirmation?: boolean;
  whatsapp_shipping_updates?: boolean;
  whatsapp_abandoned_cart?: boolean;
  whatsapp_abandoned_cart_delay_hours?: number;
  // Inbound email settings
  inbound_email_prefix?: string | null;
  inbound_email_enabled?: boolean;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  setCurrentTenant: (tenant: Tenant | null) => void;
  refreshTenants: () => Promise<void>;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = 'sellqo_selected_tenant_id';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, roles, loading: authLoading } = useAuth();
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Wrapper to persist tenant selection
  const setCurrentTenant = (tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    if (tenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY);
    }
  };

  const fetchTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenantState(null);
      localStorage.removeItem(TENANT_STORAGE_KEY);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch tenants with their active subscription data
    const { data: tenantsData, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      setTenants([]);
      setLoading(false);
      return;
    }

    // Fetch subscription data for all tenants
    const { data: subscriptionsData } = await supabase
      .from('tenant_subscriptions')
      .select('tenant_id, plan_id, status, pricing_plans(name)')
      .in('tenant_id', tenantsData?.map(t => t.id) || []);

    // Merge subscription data into tenants
    const enrichedTenants = (tenantsData || []).map(tenant => {
      const subscription = subscriptionsData?.find(s => s.tenant_id === tenant.id);
      if (subscription) {
        return {
          ...tenant,
          subscription_plan: (subscription.pricing_plans as any)?.name || tenant.subscription_plan,
          subscription_status: subscription.status || tenant.subscription_status,
        };
      }
      return tenant;
    });

    setTenants(enrichedTenants);
    
    // Try to restore previously selected tenant from localStorage
    const savedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
    const savedTenant = savedTenantId 
      ? enrichedTenants.find(t => t.id === savedTenantId) 
      : null;
    
    if (savedTenant) {
      setCurrentTenantState(savedTenant);
    } else if (!currentTenant && enrichedTenants.length > 0) {
      // Only auto-select first tenant if no saved tenant exists
      setCurrentTenant(enrichedTenants[0]);
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface ReturnSettings {
  tenant_id: string;
  returns_enabled: boolean;
  return_window_days: number;
  default_restocking_fee_percent: number;
  credit_note_policy: string;
  credit_note_prefix: string;
  credit_note_auto_email: boolean;
  customer_portal_enabled: boolean;
  customer_portal_auth: string;
  auto_approve_within_window: boolean;
  manual_approval_outside_window: boolean;
  default_refund_method: string;
  refund_shipping_by_default: boolean;
  allow_partial_refunds: boolean;
  marketplace_refund_mode: string;
  marketplace_auto_accept_within_window: boolean;
  return_shipping_paid_by: string;
  conditional_free_reasons: string[];
  return_shipping_provider: string;
  auto_generate_return_label: boolean;
  auto_restock_new_condition: boolean;
  auto_no_restock_damaged: boolean;
  stock_impact_notification_threshold: number;
  notify_customer_request_received: boolean;
  notify_customer_approved: boolean;
  notify_customer_package_received: boolean;
  notify_customer_refund_processed: boolean;
  notify_admin_new_request: boolean;
  enabled_reason_codes: string[];
}

const DEFAULT_SETTINGS: Omit<ReturnSettings, 'tenant_id'> = {
  returns_enabled: true,
  return_window_days: 14,
  default_restocking_fee_percent: 0,
  credit_note_policy: 'b2b_only',
  credit_note_prefix: 'CN',
  credit_note_auto_email: true,
  customer_portal_enabled: false,
  customer_portal_auth: 'email_order_lookup',
  auto_approve_within_window: true,
  manual_approval_outside_window: true,
  default_refund_method: 'auto_stripe',
  refund_shipping_by_default: true,
  allow_partial_refunds: true,
  marketplace_refund_mode: 'manual_redirect',
  marketplace_auto_accept_within_window: false,
  return_shipping_paid_by: 'customer',
  conditional_free_reasons: ['defect', 'damaged_in_transit', 'wrong_product'],
  return_shipping_provider: 'none',
  auto_generate_return_label: false,
  auto_restock_new_condition: true,
  auto_no_restock_damaged: true,
  stock_impact_notification_threshold: 10,
  notify_customer_request_received: true,
  notify_customer_approved: true,
  notify_customer_package_received: true,
  notify_customer_refund_processed: true,
  notify_admin_new_request: true,
  enabled_reason_codes: [
    'defect', 'damaged_in_transit', 'wrong_product', 'wrong_size',
    'not_as_described', 'changed_mind', 'late_delivery', 'duplicate_order', 'other',
  ],
};

export function useReturnSettings() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const query = useQuery({
    queryKey: ['return-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('tenant_return_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { tenant_id: tenantId, ...DEFAULT_SETTINGS } as ReturnSettings;
      return data as unknown as ReturnSettings;
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<ReturnSettings>) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenant_return_settings')
        .upsert({ tenant_id: tenantId, ...updates } as any, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-settings', tenantId] });
      toast.success('Opgeslagen');
    },
    onError: (err: Error) => {
      toast.error('Opslaan mislukt: ' + err.message);
    },
  });

  const resetToDefaults = () => {
    mutation.mutate(DEFAULT_SETTINGS as Partial<ReturnSettings>);
  };

  return {
    settings: query.data,
    isLoading: query.isLoading,
    updateSettings: mutation.mutate,
    isSaving: mutation.isPending,
    resetToDefaults,
    DEFAULT_SETTINGS,
  };
}

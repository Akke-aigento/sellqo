import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { TenantContext } from '@/hooks/useTenant';

export type PlatformPaymentMode = 'mandate' | 'manual';

export interface PlatformBillingStatus {
  success: boolean;
  has_billing_customer: boolean;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_subscription_status: string | null;
  mandate: { status: string; method_type: string } | null;
  payment_mode: PlatformPaymentMode | null;
  billing_model: string | null;
  next_invoice_date: string | null;
}

/**
 * 2a·2 — reads the tenant's own platform-billing status. The underlying rows
 * live on the internal SellQo tenant, so they are only reachable through the
 * `get-platform-billing-status` edge function (tenant-scoped RLS otherwise
 * returns zero rows).
 */
export function usePlatformBillingStatus() {
  const tenantContext = useContext(TenantContext);
  const tenantId = tenantContext?.currentTenant?.id ?? null;

  return useQuery({
    queryKey: ['platform-billing-status', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return await invokeWithErrorBody<PlatformBillingStatus>('get-platform-billing-status', {
        body: { tenant_id: tenantId, action: 'status' },
      });
    },
    enabled: !!tenantId,
  });
}

export function useCreatePlatformMandateLink() {
  const tenantContext = useContext(TenantContext);
  const tenantId = tenantContext?.currentTenant?.id ?? null;

  return useMutation({
    mutationFn: async (
      vars?: { planId?: string | null; interval?: 'monthly' | 'yearly' | null },
    ) => {
      if (!tenantId) throw new Error('Geen actieve tenant');
      return await invokeWithErrorBody<{
        success: boolean;
        url: string;
        token: string;
        billing_customer_id: string;
      }>('create-platform-mandate-setup', {
        body: {
          tenant_id: tenantId,
          ...(vars?.planId ? { plan_id: vars.planId } : {}),
          ...(vars?.interval ? { billing_interval: vars.interval } : {}),
        },
      });
    },
  });
}

export function useSetPlatformPaymentMode() {
  const tenantContext = useContext(TenantContext);
  const tenantId = tenantContext?.currentTenant?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mode: PlatformPaymentMode) => {
      if (!tenantId) throw new Error('Geen actieve tenant');
      return await invokeWithErrorBody<{ success: boolean; payment_mode: PlatformPaymentMode }>(
        'get-platform-billing-status',
        { body: { tenant_id: tenantId, action: 'set_payment_mode', payment_mode: mode } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-status', tenantId] });
    },
  });
}

export interface SyncTenantPlanResult {
  success: boolean;
  action: 'activate' | 'switch' | 'cancel';
  noop?: boolean;
  downgrade?: boolean;
  effective_at?: string | null;
  billing_subscription_id?: string | null;
  billing_customer_id?: string | null;
}

/**
 * Calls the single writer `sync-tenant-plan`. The caller decides between
 * `activate` (no billing subscription yet) and `switch` — the function returns
 * a 400 "use action=activate" that must never reach the user.
 */
export function useSyncTenantPlan() {
  const tenantContext = useContext(TenantContext);
  const tenantId = tenantContext?.currentTenant?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      planId: string;
      interval: 'monthly' | 'yearly';
      action: 'activate' | 'switch' | 'cancel';
    }) => {
      if (!tenantId) throw new Error('Geen actieve tenant');
      return await invokeWithErrorBody<SyncTenantPlanResult>('sync-tenant-plan', {
        body: {
          tenant_id: tenantId,
          plan_id: vars.planId,
          billing_interval: vars.interval,
          action: vars.action,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['platform-billing-status', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-usage'] });
    },
  });
}
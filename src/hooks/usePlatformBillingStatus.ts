import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeWithErrorBody, invokeWithNetworkRetry } from '@/lib/invokeWithErrorBody';
import { TenantContext } from '@/hooks/useTenant';

export type PlatformPaymentMode = 'mandate' | 'manual';

export interface PendingUpgrade {
  billing_cycle_id: string;
  status: string;
  total: number;
  description: string | null;
  target_plan_id: string | null;
  target_interval: 'monthly' | 'yearly' | null;
  checkout_session_url: string | null;
  payment_request_number: string | null;
  due_date: string | null;
  grace_until: string | null;
  cancellable: boolean;
}

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
  /** UPGRADE-PF-1: open pro-rata upgrade that still awaits payment. */
  pending_upgrade: PendingUpgrade | null;
  pending_plan_id: string | null;
  pending_interval: 'monthly' | 'yearly' | null;
  pending_effective_at: string | null;
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
  /** UPGRADE-PF-1 */
  pending?: boolean;
  awaiting_payment?: boolean;
  billing_cycle_id?: string | null;
  payment_request_number?: string | null;
  checkout_session_url?: string | null;
  pro_rata_total?: number;
  remaining_days?: number;
  period_days?: number;
  interval_swap?: boolean;
}

/**
 * UPGRADE-PF-1 — abort an unpaid pro-rata upgrade: the billing cycle is
 * cancelled and the pending plan markers are cleared.
 */
export function useCancelPendingUpgrade() {
  const tenantContext = useContext(TenantContext);
  const tenantId = tenantContext?.currentTenant?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Geen actieve tenant');
      // UX-POLISH-1 — stille retry bij netwerkhapering.
      return await invokeWithNetworkRetry<{ success: boolean; cancelled_billing_cycle_id: string }>(
        'get-platform-billing-status',
        { body: { tenant_id: tenantId, action: 'cancel_upgrade' } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-status', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
    },
  });
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
      // UX-POLISH-1 — stille retry bij netwerkhapering (cold start).
      return await invokeWithNetworkRetry<SyncTenantPlanResult>('sync-tenant-plan', {
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
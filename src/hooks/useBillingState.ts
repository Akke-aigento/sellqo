import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import {
  resolveBillingState,
  type BillingState,
  type BillingStateResult,
} from '../../supabase/functions/_shared/billingState';

const OPEN: BillingStateResult = { state: 'active', since: null, reason: 'none', openAmount: 0, payUrl: null };

/**
 * BILLING-ENFORCE-1 — de betaaltoestand van de winkel die open staat.
 *
 * Leest dezelfde feiten als de dagelijkse `sync-billing-state` en weegt ze met
 * dezelfde functie (`_shared/billingState.ts`), zodat scherm en server nooit iets
 * anders zeggen. De opgeslagen `tenant_subscriptions.status` is de terugval; de
 * verse berekening wint, zodat een betaling meteen zichtbaar is in plaats van pas
 * na de cron van de volgende ochtend.
 *
 * Nooit afdwingen bij: platform-admins, de interne SellQo-winkel en demowinkels —
 * dezelfde uitzonderingen als `useUsageLimits`.
 */
export function useBillingState(): BillingStateResult & { isLoading: boolean } {
  const { currentTenant } = useTenant();
  const { isPlatformAdmin } = useAuth();
  const exempt = isPlatformAdmin
    || currentTenant?.is_internal_tenant === true
    || currentTenant?.is_demo === true;

  const { data, isLoading } = useQuery({
    queryKey: ['billing-state', currentTenant?.id],
    enabled: !!currentTenant?.id && !exempt,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BillingStateResult> => {
      const { data: sub } = await supabase
        .from('tenant_subscriptions')
        .select('status, trial_end, plan_id, billing_customer_id')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();
      if (!sub) return OPEN;

      const customerId = (sub as { billing_customer_id?: string | null }).billing_customer_id ?? null;
      if (!customerId) return resolveBillingState({ subscription: sub, now: new Date() });

      const [cycles, invoices] = await Promise.all([
        supabase
          .from('billing_cycles')
          .select('id, status, due_date, grace_until, total, invoice_id, checkout_session_url, payment_request_number')
          .eq('customer_id', customerId)
          .in('status', ['awaiting_payment', 'reopened', 'expired']),
        supabase
          .from('invoices')
          .select('id, status, dunning_level, due_date, last_reminder_at, total, invoice_number')
          .eq('customer_id', customerId)
          .in('status', ['unpaid', 'sent']),
      ]);

      return resolveBillingState({
        subscription: sub,
        cycles: (cycles.data ?? []) as never,
        invoices: (invoices.data ?? []) as never,
        now: new Date(),
      });
    },
  });

  if (exempt) return { ...OPEN, isLoading: false };
  // Zolang we het niet weten: niets blokkeren. De serverguard is het echte slot.
  return { ...(data ?? OPEN), isLoading };
}

export type { BillingState };

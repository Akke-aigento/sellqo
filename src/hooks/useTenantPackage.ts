// ADDON-SELF-1 — het pakket van een winkel (plan + sporen) en zelf een spoor aan/uit zetten.
// Eén bron: sync-tenant-plan action 'package' (lezen) en 'addon' (schrijven). De prijs die
// de kaart vooraf toont, is exact wat 'addon' daarna aanrekent (zelfde berekening).
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import type { BusinessModule } from '@/hooks/useBusinessModules';

export type AddonStatus = 'in_plan' | 'included' | 'on' | 'stopping' | 'pending_payment' | 'trial' | 'off';

export type AddonQuote =
  | { kind: 'free'; total: 0 }
  | { kind: 'trial'; total: 0; billed_from: string | null }
  | { kind: 'needs_plan' }
  | { kind: 'locked' }
  | { kind: 'resume'; total: 0 }
  | { kind: 'first_month'; total: number; interval: 'monthly'; next_invoice_date: string }
  | { kind: 'payment_open' }
  | { kind: 'renewal_pending'; available_from: string }
  | { kind: 'boundary'; total: 0; interval: 'monthly' | 'yearly' }
  | { kind: 'pro_rata'; total: number; period_end: string; remaining_days: number; period_days: number; interval: 'monthly' | 'yearly' };

export interface TrackUsage { open_checks: number; upcoming_ticketed_events: number; open_orders: number }

export interface PackageAddon {
  id: string;
  track: BusinessModule;
  name: string;
  monthly_price: number;
  yearly_price: number;
  ticket_fee: number;
  billed: boolean;
  status: AddonStatus;
  end_date: string | null;
  stops_at: string | null;
  quote: AddonQuote | null;
  /** Vaste betaallink (sellqo.app/betalen/…), nooit de Stripe-sessie van ≤ 24 u. */
  pending: { total: number; pay_url: string | null; payment_request_number: string | null } | null;
  usage: TrackUsage | null;
}

export interface TenantPackage {
  plan: { id: string; name: string; track: BusinessModule; interval: 'monthly' | 'yearly'; monthly_price: number; yearly_price: number };
  trial: boolean;
  trial_end: string | null;
  billing_state: string;
  not_billed: boolean;
  addons: PackageAddon[];
}

export type AddonErrorCode =
  | 'addon_inactive' | 'addon_in_plan' | 'addon_granted' | 'account_locked' | 'addon_in_use'
  | 'addon_needs_plan' | 'renewal_pending' | 'proration_cycle_open' | 'unknown';

export interface AddonResult {
  ok: boolean;
  /** Aan (meteen, of na betaling via het mandaat). */
  enabled?: boolean;
  /** Wacht op een betaling (betaalverzoek of checkout). */
  pending?: boolean;
  trial?: boolean;
  total?: number;
  /** Vaste betaallink, met de Stripe-sessie als terugval. */
  payUrl?: string | null;
  effectiveAt?: string | null;
  error?: AddonErrorCode;
  availableFrom?: string;
  usage?: TrackUsage;
}

async function readErrorBody(error: unknown): Promise<Record<string, unknown> | undefined> {
  try {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') return (await ctx.clone().json()) as Record<string, unknown>;
  } catch { /* geen json */ }
  return undefined;
}

const KNOWN: AddonErrorCode[] = [
  'addon_inactive', 'addon_in_plan', 'addon_granted', 'account_locked', 'addon_in_use',
  'addon_needs_plan', 'renewal_pending', 'proration_cycle_open',
];

/** Wie mag het pakket van deze winkel beheren: de zaakvoerder (tenant_admin) of een platformadmin. */
export function useCanManagePackage(tenantId: string | null | undefined): boolean {
  const { isPlatformAdmin, roles } = useAuth();
  if (isPlatformAdmin) return true;
  if (!tenantId) return false;
  return (roles ?? []).some((r) => r.role === 'tenant_admin' && r.tenant_id === tenantId);
}

export function useTenantPackage(tenantIdProp?: string) {
  const { currentTenant, refreshTenants } = useTenant();
  const tenantId = tenantIdProp ?? currentTenant?.id ?? null;
  const canManage = useCanManagePackage(tenantId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['tenant-package', tenantId],
    enabled: !!tenantId && canManage,
    staleTime: 15_000,
    queryFn: async (): Promise<TenantPackage> => {
      const { data, error } = await supabase.functions.invoke('sync-tenant-plan', {
        body: { tenant_id: tenantId, action: 'package' },
      });
      if (error || !data?.success) throw error ?? new Error('package failed');
      return data as TenantPackage;
    },
  });

  const setAddon = useCallback(async (addonId: string, enabled: boolean, opts: { force?: boolean } = {}): Promise<AddonResult> => {
    if (!tenantId) return { ok: false, error: 'unknown' };
    setBusy(addonId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-tenant-plan', {
        body: { tenant_id: tenantId, action: 'addon', addon_id: addonId, enabled, ...(opts.force ? { force: true } : {}) },
      });
      const res = (data ?? {}) as Record<string, unknown>;
      if (error || !res.success) {
        const body = (res.code ? res : await readErrorBody(error)) ?? {};
        const code = KNOWN.includes(body.code as AddonErrorCode) ? (body.code as AddonErrorCode) : 'unknown';
        return { ok: false, error: code, availableFrom: body.available_from as string | undefined, usage: body.usage as TrackUsage | undefined };
      }
      return {
        ok: true,
        enabled: res.enabled === true,
        pending: res.pending === true,
        trial: res.trial === true,
        total: typeof res.pro_rata_total === 'number' ? res.pro_rata_total : undefined,
        payUrl: (res.pay_url as string | null | undefined) ?? (res.checkout_session_url as string | null | undefined) ?? null,
        effectiveAt: (res.effective_at as string | null | undefined) ?? null,
      };
    } finally {
      setBusy(null);
      await qc.invalidateQueries({ queryKey: ['tenant-package', tenantId] });
      // De zijbalk en pagina's lezen de sporen van de winkel zelf.
      if (!tenantIdProp || tenantIdProp === currentTenant?.id) await refreshTenants();
    }
  }, [tenantId, tenantIdProp, currentTenant?.id, qc, refreshTenants]);

  return { tenantId, canManage, pkg: query.data ?? null, loading: query.isLoading, failed: query.isError, refetch: query.refetch, setAddon, busy };
}

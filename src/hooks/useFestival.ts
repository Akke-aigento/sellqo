// FEST-1/2 — combitickets en munten (drank/eten) voor festivals en events.
// Tabellen ticket_bundle_items, token_settings, token_wallets, token_scanner_access,
// token_transactions (RLS: lezen tenant_admin/staff, beheren tenant_admin).
// Ze staan nog niet in de gegenereerde types, dus we praten via een ongetypeerde client.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { slugBase, uniqueSlug } from '@/lib/eventSeries';
import { PUBLIC_SITE_URL } from '@/lib/siteUrl';

const db = supabase as unknown as SupabaseClient;

export const barUrl = (token: string) => `${PUBLIC_SITE_URL}/bar/${token}`;
export const walletUrl = (code: string) => `${PUBLIC_SITE_URL}/munten/${code}`;

// ── Combitickets ────────────────────────────────────────────────────────────

export interface BundleComponentOption {
  event_detail_id: string;
  event_date: string;
  start_time: string | null;
  event_name: string;
  seated: boolean;
  types: { product_id: string; name: string }[];
}

export interface BundleRow {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  hidden: boolean;
  items: { event_detail_id: string; event_date: string; event_name: string; type_name: string }[];
  sold: number;
}

/** Datums waar een combi uit kan bestaan: aankomend, gepland, zonder zaalplan. */
export function useBundleOptions() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['bundle-options', currentTenant?.id],
    queryFn: async (): Promise<BundleComponentOption[]> => {
      if (!currentTenant) return [];
      const today = new Date().toISOString().slice(0, 10);
      const { data: evs, error } = await db.from('event_details')
        .select('id, event_date, start_time, venue_id, status, products(name)')
        .eq('tenant_id', currentTenant.id).gte('event_date', today).in('status', ['scheduled', 'confirmed'])
        .order('event_date').order('start_time').limit(200);
      if (error) throw error;
      const ids = (evs ?? []).map((e) => e.id as string);
      const { data: types } = ids.length
        ? await db.from('event_ticket_types').select('event_detail_id, product_id, sort_order, is_active, products(name)')
          .eq('tenant_id', currentTenant.id).in('event_detail_id', ids).eq('is_active', true).order('sort_order')
        : { data: [] };
      const byEvent: Record<string, { product_id: string; name: string }[]> = {};
      for (const t of types ?? []) {
        (byEvent[t.event_detail_id as string] ??= []).push({
          product_id: t.product_id as string,
          name: (t.products as { name?: string } | null)?.name ?? '',
        });
      }
      return (evs ?? []).map((e) => ({
        event_detail_id: e.id as string,
        event_date: e.event_date as string,
        start_time: (e.start_time as string | null) ?? null,
        event_name: (e.products as { name?: string } | null)?.name ?? '',
        seated: !!e.venue_id,
        types: byEvent[e.id as string] ?? [],
      }));
    },
    enabled: !!currentTenant,
  });
}

export function useBundles() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['bundles', currentTenant?.id],
    queryFn: async (): Promise<BundleRow[]> => {
      if (!currentTenant) return [];
      const { data: items, error } = await db.from('ticket_bundle_items')
        .select('bundle_product_id, event_detail_id, sort_order, event_details(event_date, products(name)), products!ticket_bundle_items_component_product_id_fkey(name)')
        .eq('tenant_id', currentTenant.id).order('sort_order');
      if (error) throw error;
      const bundleIds = [...new Set((items ?? []).map((i) => i.bundle_product_id as string))];
      if (!bundleIds.length) return [];
      const [{ data: products }, { data: sold }] = await Promise.all([
        db.from('products').select('id, name, price, is_active, hide_from_storefront').in('id', bundleIds),
        db.from('order_items').select('product_id, quantity, orders!inner(payment_status)')
          .in('product_id', bundleIds).eq('orders.payment_status', 'paid'),
      ]);
      const soldBy: Record<string, number> = {};
      for (const s of sold ?? []) soldBy[s.product_id as string] = (soldBy[s.product_id as string] ?? 0) + Number(s.quantity ?? 0);
      return (products ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        price: Number(p.price),
        is_active: p.is_active !== false,
        hidden: p.hide_from_storefront === true,
        sold: soldBy[p.id as string] ?? 0,
        items: (items ?? []).filter((i) => i.bundle_product_id === p.id).map((i) => {
          const ev = i.event_details as { event_date?: string; products?: { name?: string } } | null;
          return {
            event_detail_id: i.event_detail_id as string,
            event_date: ev?.event_date ?? '',
            event_name: ev?.products?.name ?? '',
            type_name: (i.products as { name?: string } | null)?.name ?? '',
          };
        }),
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!currentTenant,
  });
}

export interface NewBundleInput {
  name: string;
  description: string;
  price: number;
  hidden: boolean;
  components: { event_detail_id: string; product_id: string }[];
}

export function useCreateBundle() {
  const { currentTenant } = useTenant();
  const { enforceLimit } = useUsageLimits();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBundleInput) => {
      if (!currentTenant) throw new Error('no_tenant');
      if (input.components.length < 2) throw new Error('too_few');
      const limit = await enforceLimit('products');
      if (!limit.allowed) throw new Error('limit');
      const tenantId = currentTenant.id;
      const base = slugBase(input.name);
      const { data: existing } = await db.from('products').select('slug').eq('tenant_id', tenantId).like('slug', `${base}%`);
      const slug = uniqueSlug(base, (existing ?? []).map((r) => r.slug as string));
      const { data: product, error } = await db.from('products').insert({
        tenant_id: tenantId, name: input.name.trim(), slug,
        description: input.description.trim() || null, short_description: '',
        price: input.price, product_type: 'ticket', requires_shipping: false,
        track_inventory: false, stock: 0, is_active: true, hide_from_storefront: input.hidden,
        images: [],
      }).select('id').single();
      if (error || !product) throw error ?? new Error('product_failed');
      const productId = product.id as string;
      const { error: iErr } = await db.from('ticket_bundle_items').insert(
        input.components.map((c, i) => ({
          tenant_id: tenantId, bundle_product_id: productId, event_detail_id: c.event_detail_id,
          component_product_id: c.product_id, sort_order: i,
        })),
      );
      if (iErr) {
        await db.from('products').delete().eq('id', productId).eq('tenant_id', tenantId);
        throw iErr;
      }
      return productId;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['bundles'] }); },
  });
}

export function useUpdateBundle() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { price?: number; is_active?: boolean; hide_from_storefront?: boolean } }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await db.from('products').update(patch).eq('id', id).eq('tenant_id', currentTenant.id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['bundles'] }); },
  });
}

// ── Munten ──────────────────────────────────────────────────────────────────

export interface TokenSettings {
  token_name: string;
  token_name_plural: string;
  refund_enabled: boolean;
  refund_until: string | null;
  refund_fee: number;
}

export const DEFAULT_TOKEN_SETTINGS: TokenSettings = {
  token_name: 'munt', token_name_plural: 'munten', refund_enabled: false, refund_until: null, refund_fee: 0,
};

export function useTokenSettings() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['token-settings', currentTenant?.id],
    queryFn: async (): Promise<TokenSettings & { exists: boolean }> => {
      if (!currentTenant) return { ...DEFAULT_TOKEN_SETTINGS, exists: false };
      const { data, error } = await db.from('token_settings')
        .select('token_name, token_name_plural, refund_enabled, refund_until, refund_fee')
        .eq('tenant_id', currentTenant.id).maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_TOKEN_SETTINGS, exists: false };
      return { ...(data as TokenSettings), refund_fee: Number(data.refund_fee ?? 0), exists: true };
    },
    enabled: !!currentTenant,
  });
}

export function useSaveTokenSettings() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: TokenSettings) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await db.from('token_settings').upsert({
        tenant_id: currentTenant.id, ...s, updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['token-settings'] }); },
  });
}

export interface TokenPack { id: string; name: string; price: number; token_amount: number; is_active: boolean; hidden: boolean }

export function useTokenPacks() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['token-packs', currentTenant?.id],
    queryFn: async (): Promise<TokenPack[]> => {
      if (!currentTenant) return [];
      const { data, error } = await db.from('products')
        .select('id, name, price, token_amount, is_active, hide_from_storefront')
        .eq('tenant_id', currentTenant.id).not('token_amount', 'is', null).order('token_amount');
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id as string, name: p.name as string, price: Number(p.price), token_amount: Number(p.token_amount),
        is_active: p.is_active !== false, hidden: p.hide_from_storefront === true,
      }));
    },
    enabled: !!currentTenant,
  });
}

export function useCreateTokenPack() {
  const { currentTenant } = useTenant();
  const { enforceLimit } = useUsageLimits();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, price, tokens, description }: { name: string; price: number; tokens: number; description: string }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const limit = await enforceLimit('products');
      if (!limit.allowed) throw new Error('limit');
      const base = slugBase(name);
      const { data: existing } = await db.from('products').select('slug').eq('tenant_id', currentTenant.id).like('slug', `${base}%`);
      const slug = uniqueSlug(base, (existing ?? []).map((r) => r.slug as string));
      const { error } = await db.from('products').insert({
        tenant_id: currentTenant.id, name: name.trim(), slug, description: description.trim() || null, short_description: '',
        price, product_type: 'digital', requires_shipping: false, track_inventory: false, stock: 0,
        is_active: true, hide_from_storefront: false, images: [], token_amount: tokens,
      });
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['token-packs'] }); },
  });
}

export interface TokenScanner { id: string; name: string; access_token: string; is_active: boolean; last_used_at: string | null; use_count: number }

export function useTokenScanners() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['token-scanners', currentTenant?.id],
    queryFn: async (): Promise<TokenScanner[]> => {
      if (!currentTenant) return [];
      const { data, error } = await db.from('token_scanner_access')
        .select('id, name, access_token, is_active, last_used_at, use_count')
        .eq('tenant_id', currentTenant.id).order('created_at');
      if (error) throw error;
      return (data ?? []) as TokenScanner[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateTokenScanner() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { data, error } = await db.from('token_scanner_access')
        .insert({ tenant_id: currentTenant.id, name: name.trim() }).select('id, name, access_token, is_active, last_used_at, use_count').single();
      if (error) throw error;
      return data as TokenScanner;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['token-scanners'] }); },
  });
}

export function useToggleTokenScanner() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await db.from('token_scanner_access').update({ is_active }).eq('id', id).eq('tenant_id', currentTenant.id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['token-scanners'] }); },
  });
}

export interface TokenStats { wallets: number; sold: number; spent: number; outstanding: number; refunded: number; refund_requests: number }

export function useTokenStats() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['token-stats', currentTenant?.id],
    queryFn: async (): Promise<TokenStats> => {
      const out: TokenStats = { wallets: 0, sold: 0, spent: 0, outstanding: 0, refunded: 0, refund_requests: 0 };
      if (!currentTenant) return out;
      const [{ data: wallets, error }, { data: txs }] = await Promise.all([
        db.from('token_wallets').select('purchased, balance, status').eq('tenant_id', currentTenant.id).limit(10000),
        db.from('token_transactions').select('delta, kind').eq('tenant_id', currentTenant.id).in('kind', ['spend', 'undo', 'refund']).limit(50000),
      ]);
      if (error) throw error;
      for (const w of wallets ?? []) {
        out.wallets += 1;
        out.sold += Number(w.purchased ?? 0);
        out.outstanding += w.status === 'refunded' ? 0 : Number(w.balance ?? 0);
        if (w.status === 'refund_requested') out.refund_requests += 1;
      }
      for (const t of txs ?? []) {
        if (t.kind === 'refund') out.refunded += -Number(t.delta);
        else out.spent += -Number(t.delta);
      }
      return out;
    },
    enabled: !!currentTenant,
    refetchInterval: 30000,
  });
}

export interface WalletRow {
  id: string; code: string; customer_name: string | null; customer_email: string | null;
  purchased: number; balance: number; status: string; return_id: string | null; created_at: string;
  order_number: string | null;
}

export function useWallets(query: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['token-wallets', currentTenant?.id, query],
    queryFn: async (): Promise<WalletRow[]> => {
      if (!currentTenant) return [];
      let q = db.from('token_wallets')
        .select('id, code, customer_name, customer_email, purchased, balance, status, return_id, created_at, orders(order_number)')
        .eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }).limit(50);
      const s = query.trim().replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ');
      if (s.length >= 2) q = q.or(`customer_name.ilike.%${s}%,customer_email.ilike.%${s}%,code.ilike.${s.toLowerCase()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((w) => ({
        ...(w as unknown as WalletRow),
        order_number: (w.orders as { order_number?: string } | null)?.order_number ?? null,
      }));
    },
    enabled: !!currentTenant,
  });
}

export function useAdjustWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ walletId, delta, note }: { walletId: string; delta: number; note: string }) => {
      const { error } = await db.rpc('adjust_wallet', { p_wallet_id: walletId, p_delta: delta, p_note: note });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['token-wallets'] });
      void qc.invalidateQueries({ queryKey: ['token-stats'] });
    },
  });
}

/** Kaart blokkeren (verloren of misbruikt) of weer vrijgeven. Alleen tussen active en blocked. */
export function useSetWalletBlocked() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ walletId, blocked }: { walletId: string; blocked: boolean }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await db.from('token_wallets')
        .update({ status: blocked ? 'blocked' : 'active', updated_at: new Date().toISOString() })
        .eq('id', walletId).eq('tenant_id', currentTenant.id).eq('status', blocked ? 'active' : 'blocked');
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['token-wallets'] }); },
  });
}

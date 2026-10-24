// KAART-1 — data voor de tab Kaart: categorieën + producten van de zaak, en de schrijfacties.
// Lezen en kleine bewerkingen (naam, prijs, kanalen) gaan rechtstreeks via RLS; aanmaken en
// bulk via de kaart_*-functies (unieke slugs, standaard-btw, rolcontrole op de server).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useVatRates } from '@/hooks/useVatRates';
import { VAT_BY_KIND, type VatKind } from './starterKaart';

export interface KaartCategory {
  id: string;
  name: string;
  sort_order: number | null;
  is_active: boolean | null;
  default_vat_rate_id: string | null;
  default_takeaway_vat_rate_id: string | null;
}

export interface KaartProduct {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
  channels: string[] | null;
  sold_out_until: string | null;
  vat_rate_id: string | null;
  takeaway_vat_rate_id: string | null;
}

export interface KaartItemInput { name: string; price: string; category_id: string | null }

export type BulkChange =
  | { price: { mode: 'set' | 'add' | 'percent'; value: string } }
  | { is_active: boolean }
  /** Verplaatsen; met apply_category_vat neemt het product ook de btw van de nieuwe categorie over. */
  | { category_id: string; apply_category_vat?: true }
  | { apply_category_vat: true };

/** Tickets, cadeaubonnen, abonnementen en bundels horen niet op een horecakaart. */
const KAART_TYPES = ['physical', 'service', 'digital'];

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;

export const kaartKey = (tenantId: string | undefined) => ['kaart', tenantId];

export function useKaart() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: kaartKey(tenantId),
    enabled: !!tenantId,
    queryFn: async () => {
      const [cats, prods] = await Promise.all([
        supabase.from('categories').select('id, name, sort_order, is_active, default_vat_rate_id, default_takeaway_vat_rate_id')
          .eq('tenant_id', tenantId!).order('sort_order').order('name'),
        supabase.from('products').select('id, name, price, category_id, is_active, channels, sold_out_until, vat_rate_id, takeaway_vat_rate_id')
          .eq('tenant_id', tenantId!).in('product_type', KAART_TYPES as never).order('name').limit(2000),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      return {
        categories: (cats.data ?? []) as unknown as KaartCategory[],
        products: ((prods.data ?? []) as unknown as KaartProduct[]).map((p) => ({ ...p, price: Number(p.price) })),
      };
    },
  });
}

/** Btw-tarieven van het land van de zaak, plus de id's voor 21/12/6 % (startkaart). */
export function useKaartVat() {
  const { currentTenant } = useTenant();
  const country = (currentTenant?.country || 'BE').toUpperCase();
  const { vatRates, isLoading } = useVatRates(country);
  return useMemo(() => {
    const rates = vatRates.filter((r) => r.is_active !== false);
    const byRate = (n: number) => rates.find((r) => Number(r.rate) === n && !r.tenant_id)?.id ?? rates.find((r) => Number(r.rate) === n)?.id ?? null;
    const forKind = (kind: VatKind): [string | null, string | null] => {
      const [here, away] = VAT_BY_KIND[kind];
      return [byRate(here), byRate(away)];
    };
    return { rates, isLoading, forKind, rateOf: (id: string | null) => rates.find((r) => r.id === id)?.rate ?? null };
  }, [vatRates, isLoading]);
}

export function useKaartMutations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: kaartKey(tenantId) });
    qc.invalidateQueries({ queryKey: ['products'] });
    // De kassa leest dezelfde producten (TAFEL-1).
    qc.invalidateQueries({ queryKey: ['kassa-catalog', tenantId] });
  };

  const ensureCategory = async (name: string, vat: [string | null, string | null] = [null, null]) => {
    const { data, error } = await rpc('kaart_ensure_category', { p_tenant_id: tenantId, p_name: name, p_vat_rate_id: vat[0], p_takeaway_vat_rate_id: vat[1] });
    if (error) throw error;
    return data as string;
  };

  const addProducts = async (items: KaartItemInput[]) => {
    const out: { id: string; name: string }[] = [];
    for (let i = 0; i < items.length; i += 300) {
      const { data, error } = await rpc('kaart_add_products', { p_tenant_id: tenantId, p_items: items.slice(i, i + 300) });
      // Per blok van 300 alles of niets; wat al lukte, melden we mee.
      if (error) throw Object.assign(new Error(error.message), { code: error.code, created: out.length });
      out.push(...((data as { id: string; name: string }[]) ?? []));
    }
    return out;
  };

  const add = useMutation({ mutationFn: addProducts, onSettled: refresh });

  const createCategory = useMutation({
    mutationFn: ({ name, vat }: { name: string; vat?: [string | null, string | null] }) => ensureCategory(name, vat),
    onSettled: refresh,
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<KaartProduct, 'name' | 'price' | 'is_active' | 'channels'>> }) => {
      const { error } = await supabase.from('products').update(patch as never).eq('id', id).eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<KaartCategory, 'name' | 'default_vat_rate_id' | 'default_takeaway_vat_rate_id'>> }) => {
      const { error } = await supabase.from('categories').update(patch as never).eq('id', id).eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const bulk = useMutation({
    mutationFn: async ({ ids, change }: { ids: string[]; change: BulkChange }) => {
      let n = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error } = await rpc('kaart_bulk_update', { p_tenant_id: tenantId, p_ids: ids.slice(i, i + 500), p: change });
        if (error) throw error;
        n += Number(data ?? 0);
      }
      return n;
    },
    onSettled: refresh,
  });

  /**
   * Een lijst importeren (plakken, startkaart, foto): eerst de categorieën op naam opzoeken of
   * aanmaken, dan de producten. Bestaande categorieën houden hun eigen standaarden.
   */
  const importLines = useMutation({
    mutationFn: async ({ lines, vatFor }: {
      lines: { name: string; price: string; category: string | null; categoryId?: string | null }[];
      vatFor?: (category: string) => [string | null, string | null];
    }) => {
      const ids = new Map<string, string>();
      for (const name of [...new Set(lines.map((l) => (l.categoryId ? null : l.category?.trim())).filter(Boolean) as string[])]) {
        ids.set(name.toLocaleLowerCase('nl'), await ensureCategory(name, vatFor?.(name) ?? [null, null]));
      }
      return addProducts(lines.map((l) => ({
        name: l.name,
        price: l.price,
        category_id: l.categoryId ?? (l.category ? ids.get(l.category.trim().toLocaleLowerCase('nl')) ?? null : null),
      })));
    },
    onSettled: refresh,
  });

  return { add, createCategory, updateProduct, updateCategory, bulk, importLines };
}

/** Foutcode van Postgres → leesbare reden voor een toast. */
export function kaartErrorKey(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (code === '42501') return 'admin.kaart.error.not_allowed';
  if (/PLAN_LIMIT/.test(msg)) return 'admin.kaart.error.plan_limit';
  return 'admin.kaart.error.generic';
}

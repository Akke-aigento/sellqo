// TAFEL-1 — de kaart op de kassa: producten (kanaal 'pos'), categorieën, btw-label en extra's.
// Enkel voor weergave en snelle optimistische lijnen; de prijs die telt, rekent de server.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CheckLine } from './types';

export interface CatalogAddonGroup { id: string; name: string; min: number; max: number | null; options: { id: string; name: string; price_cents: number }[] }
export interface CatalogProduct {
  id: string;
  name: string;
  price_cents: number;
  vat_label: CheckLine['vat_label'];
  /** KASSA-0.6: label bij meenemen aan de toog (takeaway_vat_rate_id, anders = vat_label). */
  vat_label_takeaway: CheckLine['vat_label'];
  category_id: string | null;
  sold_out: boolean;
  addonGroups: CatalogAddonGroup[];
}
export interface Catalog { products: CatalogProduct[]; categories: { id: string; name: string }[] }

const LABEL: Record<number, CheckLine['vat_label']> = { 21: 'A', 12: 'B', 6: 'C', 0: 'D' };

interface ProductRow { id: string; name: string; price: number; category_id: string | null; vat_rate_id: string | null; takeaway_vat_rate_id: string | null; menu_position: number | null; channels: string[] | null; sold_out_until: string | null }

/** Zelfde logica als de server (horeca_apply) en storefront: product of een van zijn categorieën. */
export function groupsFor(p: { id: string; category_id: string | null }, extraCats: string[], groups: { id: string; name: string; min_select: number | null; max_select: number | null; category_ids: string[] | null; product_ids: string[] | null; sort_order: number }[], options: { id: string; group_id: string; name: string; price: number | null; sort_order: number }[]): CatalogAddonGroup[] {
  const cats = [p.category_id, ...extraCats].filter(Boolean) as string[];
  return groups
    .filter((g) => (g.product_ids || []).includes(p.id) || (g.category_ids || []).some((c) => cats.includes(c)))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((g) => ({
      id: g.id, name: g.name, min: Math.max(0, g.min_select ?? 0), max: g.max_select,
      options: options.filter((o) => o.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order).map((o) => ({ id: o.id, name: o.name, price_cents: Math.round(Number(o.price ?? 0) * 100) })),
    }))
    .filter((g) => g.options.length > 0);
}

/** Volgorde op de kassa: categorievolgorde, dan menu_position (leeg = achteraan), dan naam. */
export function sortCatalog(a: { name: string; category_id: string | null; menu_position: number | null }, b: { name: string; category_id: string | null; menu_position: number | null }, catOrder: Map<string, number>): number {
  const ca = a.category_id != null ? catOrder.get(a.category_id) ?? 1e9 : 1e9;
  const cb = b.category_id != null ? catOrder.get(b.category_id) ?? 1e9 : 1e9;
  return ca - cb || (a.menu_position ?? 1e9) - (b.menu_position ?? 1e9) || a.name.localeCompare(b.name, 'nl');
}

export function useCatalog(tenantId: string | null) {
  return useQuery({
    queryKey: ['kassa-catalog', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Catalog> => {
      const [prod, cats, rates, groups, options, pcats] = await Promise.all([
        supabase.from('products').select('id, name, price, category_id, vat_rate_id, takeaway_vat_rate_id, channels, sold_out_until, menu_position').eq('tenant_id', tenantId!).eq('is_active', true).order('name'),
        supabase.from('categories').select('id, name, sort_order').eq('tenant_id', tenantId!).eq('is_active', true).order('sort_order').order('name'),
        // KASSA-0.6: de tarieven staan live globaal (tenant_id null); zoals de server
        // (kassa_product_vat_rate) ook die van de zaak zelf, en ook inactieve (een product op
        // een oud tarief blijft dat tarief hebben).
        supabase.from('vat_rates').select('id, rate, is_default, is_active, tenant_id').or(`tenant_id.is.null,tenant_id.eq.${tenantId}`),
        supabase.from('product_addon_groups').select('id, name, min_select, max_select, category_ids, product_ids, sort_order').eq('tenant_id', tenantId!).eq('is_active', true),
        supabase.from('product_addon_options').select('id, group_id, name, price, sort_order').eq('tenant_id', tenantId!).eq('is_active', true),
        supabase.from('product_categories').select('product_id, category_id'),
      ]);
      for (const r of [prod, cats, rates, groups, options]) if (r.error) throw r.error;
      const rateById = new Map((rates.data ?? []).map((r) => [r.id, Number(r.rate)]));
      // Zelfde terugval als de server: standaard van de zaak zelf, anders 21 %.
      const defaultRate = Number((rates.data ?? []).find((r) => r.tenant_id === tenantId && r.is_default && r.is_active !== false)?.rate ?? 21);
      const extra = new Map<string, string[]>();
      for (const pc of (pcats.data ?? []) as { product_id: string; category_id: string }[]) extra.set(pc.product_id, [...(extra.get(pc.product_id) ?? []), pc.category_id]);
      const now = Date.now();
      // KASSA-0.6.1: volgorde zoals op de Kaart: categorie, dan positie, dan naam.
      const catOrder = new Map(((cats.data ?? []) as { id: string }[]).map((c, i) => [c.id, i]));
      const rows = ((prod.data ?? []) as unknown as ProductRow[]).slice().sort((a, b) => sortCatalog(a, b, catOrder));
      const products = rows
        // Kanaal 'pos' (HORECA-CHANNELS-1); zonder kanaalinstelling = overal.
        .filter((p) => !p.channels || p.channels.length === 0 || p.channels.includes('pos'))
        .map((p) => {
          const rate = p.vat_rate_id ? rateById.get(p.vat_rate_id) ?? defaultRate : defaultRate;
          const away = p.takeaway_vat_rate_id ? rateById.get(p.takeaway_vat_rate_id) ?? rate : rate;
          return {
            id: p.id, name: p.name, price_cents: Math.round(Number(p.price) * 100), vat_label: LABEL[rate] ?? 'A', vat_label_takeaway: LABEL[away] ?? 'A', category_id: p.category_id,
            sold_out: !!p.sold_out_until && new Date(p.sold_out_until).getTime() > now,
            addonGroups: groupsFor(p, extra.get(p.id) ?? [], (groups.data ?? []) as never, (options.data ?? []) as never),
          };
        });
      const used = new Set(products.map((p) => p.category_id));
      return { products, categories: ((cats.data ?? []) as { id: string; name: string }[]).filter((c) => used.has(c.id)) };
    },
  });
}

/**
 * KASSA-UX-1 — "Populair" op de kassa: de meest verkochte producten uit de recentste verstuurde
 * kassalijnen (max. 1000, laatste 30 dagen). Enkel een rangorde om sneller te tikken; geen cijfer
 * dat ergens getoond wordt.
 */
export function usePopularLines(tenantId: string | null) {
  return useQuery({
    queryKey: ['kassa-popular', tenantId],
    enabled: !!tenantId,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<{ product_id: string | null; qty: number }[]> => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase.from('check_lines').select('product_id, qty')
        .eq('tenant_id', tenantId!).eq('state', 'sent').gt('qty', 0).gte('created_at', since)
        .order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as { product_id: string | null; qty: number }[];
    },
  });
}

import { products, categories } from './data';
export type { CatalogProduct, Catalog } from '@/kassa/app/horeca/useCatalog';
const now = Date.now();
const live = (iso: unknown) => typeof iso === 'string' && new Date(iso).getTime() > now;
export function useCatalog() {
  return { data: {
    products: products.map((p) => ({ id: p.id, name: p.name, price_cents: Math.round(p.price * 100), vat_label: 'A', vat_label_takeaway: 'A', category_id: p.category_id,
      sold_out: live(p.sold_out_until), daily_special: live((p as { daily_special_until?: string }).daily_special_until), addonGroups: [] })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  } };
}
export function usePopularLines() { return { data: [] }; }

// De Kaart van Café De Wissel, met kostprijzen (één zonder, één boven 35 %).
import data from '../../kassa-home/data.json';
const cats = (data.categories as { id: string; name: string }[]).map((c, i) => ({ id: c.id, name: c.name, sort_order: i, is_active: true, default_vat_rate_id: 'v21', default_takeaway_vat_rate_id: 'v6' }));
const costs = [0.95, null, 3.9, 1.2, 0.6, 2.4, 5.5, 0.4];
const products = (data.products as { id: string; name: string; price_cents: number; category_id: string }[]).map((p, i) => ({
  id: p.id, name: p.name, price: p.price_cents / 100, category_id: p.category_id, is_active: true, channels: null, sold_out_until: null,
  vat_rate_id: 'v21', takeaway_vat_rate_id: null, menu_position: i, short_description: null, allergens: [], featured_image: null, images: [], cost_price: costs[i % costs.length],
}));
export const kaartKey = (id?: string) => ['kaart', id];
export const byMenuOrder = () => 0;
export function useKaart() { return { data: { categories: cats, products }, isLoading: false }; }
const mut = { mutate: () => {}, mutateAsync: async () => ({}), isPending: false };
export function useKaartMutations() { return { add: mut, createCategory: mut, updateProduct: mut, updateCategory: mut, bulk: mut, importLines: mut, reorder: mut, duplicate: mut }; }
const rates = [{ id: 'v21', rate: 21, tenant_id: null, is_default: false }, { id: 'v12', rate: 12 }, { id: 'v6', rate: 6 }];
export function useKaartVat() { return { rates, isLoading: false, forKind: () => [null, null], defaultRate: 21, rateOf: (id: string | null) => rates.find((r) => r.id === id)?.rate ?? null }; }
export function kaartErrorKey() { return 'admin.kaart.error.generic'; }

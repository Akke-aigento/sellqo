// Elke query geeft niets terug (lege lijst / null), behalve products en categories: daar de kaart van
// Café De Wissel met de drie allergenenstanden (ALLERGEEN-ADMIN-1).
import data from '../../kassa-home/data.json';
type Res = { data: unknown; error: null };
const products = (data.products as { id: string; name: string; category_id: string }[]).map((p, i) => ({
  id: p.id, name: p.name, category_id: p.category_id,
  allergens: i % 3 === 0 ? ['gluten', 'milk'] : [], allergens_declared: i % 3 === 0 || i % 3 === 1,
}));
const categories = (data.categories as { id: string; name: string }[]).map((c, i) => ({ id: c.id, name: c.name, sort_order: i }));
// tenants: één rij met de betaalinstellingen (TransactionFeeSettings leest die met .single()).
const tenants = { id: 't1', stripe_payment_methods: ['card', 'bancontact'], pass_transaction_fee_to_customer: false, transaction_fee_label: null, payment_methods_order: null, bank_transfer_enabled: false };
const rows: Record<string, unknown> = { products, categories, tenants };
function chain(table?: string): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => Promise.resolve({ data: (table && rows[table]) ?? null, error: null }).then(ok);
  return q;
}
export const supabase = {
  from: (table: string) => chain(table),
  rpc: () => chain(),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

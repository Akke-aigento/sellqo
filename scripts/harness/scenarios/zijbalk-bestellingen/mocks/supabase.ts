// ZIJBALK-BESTELLINGEN-1 — enkel de drie tabellen die useHorecaOrdersNav leest, gestuurd via ?online=:
//   on     = website online, online bestellen aan, afhalen actief (Bistro Mirabelle, Fiamma, De Wissel live)
//   off    = online bestellen uit, geen afhaal-/levermethode, geen bestellingen
//   orders = online bestellen uit, maar er bestaat nog een (oude) bestelling
// Elke query wordt gelogd in window.__queries, zodat de stappen kunnen nagaan wat er opgevraagd werd.
const mode = new URLSearchParams(location.search).get('online') ?? 'on';
type Res = { data: unknown; error: null };
const rows: Record<string, unknown> = {
  tenant_theme_settings: { use_custom_frontend: false, shop_live: true, shop_ordering: mode === 'on' },
  shipping_methods: mode === 'on' ? [{ fulfillment_type: 'pickup' }] : [],
  orders: mode === 'orders' ? [{ id: 'o1' }] : [],
};
const log = ((window as unknown as { __queries?: string[] }).__queries ??= []);
function chain(table?: string): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => { if (table) log.push(table); return Promise.resolve({ data: (table && rows[table]) ?? null, error: null }).then(ok); };
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

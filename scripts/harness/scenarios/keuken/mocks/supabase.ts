// KASSA-MOBIEL-1 — keukenscherm: webshop staat open (dus ook de knop "Pauze"), al de rest leeg.
type Res = { data: unknown; error: null };
const rows: Record<string, unknown> = { tenant_theme_settings: { shop_live: true, shop_ordering: true }, fulfillment_settings: { paused_until: null } };
function chain(table?: string): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete', 'or', 'not']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => Promise.resolve({ data: (table && rows[table]) ?? null, error: null }).then(ok);
  return q;
}
export const supabase = {
  from: (table: string) => chain(table),
  rpc: () => chain(),
  auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

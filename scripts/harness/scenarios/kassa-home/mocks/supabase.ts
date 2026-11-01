// Elke query geeft niets terug (lege lijst / null).
type Res = { data: unknown; error: null };
// GANGEN-1: window.__harness.courses = rij voor horeca_pay_settings (gangen aan in het harnas).
function chain(table?: string): unknown {
  const q: Record<string, unknown> = {};
  const row = table === 'horeca_pay_settings' ? (window as unknown as { __harness?: { courses?: unknown } }).__harness?.courses ?? null : null;
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => Promise.resolve({ data: row, error: null }).then(ok);
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

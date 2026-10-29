// Elke query geeft niets terug (lege lijst / null).
type Res = { data: unknown; error: null };
function chain(): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => Promise.resolve({ data: null, error: null }).then(ok);
  return q;
}
export const supabase = {
  from: () => chain(),
  rpc: () => chain(),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

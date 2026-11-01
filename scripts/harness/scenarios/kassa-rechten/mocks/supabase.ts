// KASSA-RECHTEN-1 / KASSA-UX-6: goedkeurders (pos_cashiers), een akkoord (kassa_approve) en "Mijn dienst".
type Res = { data: unknown; error: null };
function chain(result: () => unknown): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown) => Promise.resolve({ data: result(), error: null }).then(ok);
  return q;
}
const approvers = [{ id: 's-els', display_name: 'Els (eigenaar)', role: 'owner' }, { id: 's-sofie', display_name: 'Sofie', role: 'manager' }];
const rpc = (name: string) => {
  if (name === 'kassa_approve') return { ok: true, approval_id: '00000000-0000-0000-0000-00000000a001', approver_name: 'Els (eigenaar)' };
  if (name === 'kassa_my_shift') return { booking_date: '2026-11-01', from: new Date(Date.now() - 5 * 3600_000).toISOString(), to: new Date().toISOString(), count: 23, total_cents: 61840, tips_cents: 4250 };
  return null;
};
export const supabase = {
  from: (table: string) => chain(() => (table === 'pos_cashiers' ? approvers : null)),
  rpc: (name: string) => chain(() => rpc(name)),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

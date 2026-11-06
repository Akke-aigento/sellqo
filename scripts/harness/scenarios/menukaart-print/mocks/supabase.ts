// Harnas menukaart-print: een kettingbare nep-client. Elke query geeft window.__db[tabel];
// upserts worden gelogd in window.__writes.
type W = { __db: Record<string, unknown[]>; __writes: unknown[] };
const w = window as unknown as W;
w.__writes = w.__writes ?? [];
function builder(table: string) {
  let single = false;
  const b: Record<string, unknown> = {};
  const self = () => b;
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range', 'contains', 'is', 'neq', 'gt', 'lt', 'gte', 'lte', 'or', 'not', 'overlaps', 'filter', 'match']) b[m] = self;
  b.maybeSingle = () => { single = true; return b; };
  b.single = () => { single = true; return b; };
  b.upsert = async (row: unknown) => { w.__writes.push({ table, row }); return { error: null }; };
  b.update = () => b; b.insert = async () => ({ error: null });
  b.then = (res: (v: unknown) => unknown) => {
    const rows = (w.__db?.[table] ?? []) as unknown[];
    return Promise.resolve(res({ data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length }));
  };
  return b;
}
export const supabase = {
  from: (t: string) => builder(t),
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }), list: async () => ({ data: [], error: null }) }) },
  auth: { getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
};

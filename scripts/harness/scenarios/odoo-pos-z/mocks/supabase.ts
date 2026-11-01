// KASSA-ODOO-1 harnas — de log-rijen komen uit window.__harness.log; rpc's geven vaste antwoorden
// en worden bijgehouden in window.__rpc (zodat steps.mjs kan nagaan wat er aangeroepen werd).
type Res = { data: unknown; error: { message: string } | null };
const H = ((window as unknown as { __harness?: Record<string, unknown> }).__harness ?? {}) as { log?: Array<Record<string, unknown>>; count?: number };
const w = window as unknown as { __rpc?: Array<{ name: string; args: unknown }> };
function chain(res: () => Res) {
  const q: Record<string, unknown> = {};
  let statuses: string[] | null = null;
  for (const m of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) q[m] = () => q;
  q.in = (_c: string, v: string[]) => { statuses = v; return q; };
  q.then = (ok: (r: Res) => unknown) => Promise.resolve(res()).then((r) => ok(statuses ? { ...r, data: (r.data as Array<{ sync_status: string }>).filter((x) => statuses!.includes(x.sync_status)) } : r));
  return q;
}
export const supabase = {
  from: () => ({ select: () => chain(() => ({ data: H.log ?? [], error: null })) }),
  rpc: (name: string, args: unknown) => {
    (w.__rpc ||= []).push({ name, args });
    if (name === 'odoo_pos_z_backfill_count') return Promise.resolve({ data: H.count ?? 3, error: null });
    return Promise.resolve({ data: { ok: true }, error: null });
  },
};

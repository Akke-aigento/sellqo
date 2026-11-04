// HORECA-NU-1 — nep-databank voor het Nu-paneel in beheer. Schrijfacties komen in window.__writes; het harnas
// bewijst opmaak en klikgedrag, geen dataflow (R17).
import { areas, categories, closures, pausedUntil, products } from './data';
type Res = { data: unknown; error: null; count?: number };
const rows: Record<string, unknown> = {
  tenant_theme_settings: { shop_live: true, shop_ordering: true },
  fulfillment_settings: { tenant_id: 't1', qr_mode: 'order', qr_flow: 'check', qr_pay_counter: true, qr_pay_online: false, paused_until: pausedUntil, pay_on_pickup: true },
  business_hours: { week: {}, closures, timezone: 'Europe/Brussels' },
  products, categories, dining_areas: areas, legal_pages: [{ id: 'l1' }], vat_rates: [],
};
const w = window as unknown as { __writes?: unknown[] };
w.__writes = [];
function chain(table?: string, rpc?: string): unknown {
  let single = false;
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'range', 'delete', 'overlaps', 'contains']) q[m] = () => q;
  q.single = () => { single = true; return q; };
  q.maybeSingle = () => { single = true; return q; };
  for (const m of ['insert', 'update', 'upsert']) q[m] = (v: unknown) => { w.__writes!.push({ table, m, v }); return q; };
  q.then = (ok: (r: Res) => unknown) => {
    if (rpc) { w.__writes!.push({ rpc }); return Promise.resolve({ data: rpc === 'business_hours_close_today' ? { closed: true } : null, error: null }).then(ok); }
    const r = table ? rows[table] : null;
    const data = single ? (Array.isArray(r) ? r[0] ?? null : r ?? null) : (r == null ? [] : Array.isArray(r) ? r : [r]);
    return Promise.resolve({ data, error: null, count: 8 }).then(ok);
  };
  return q;
}
export const supabase = {
  from: (table: string) => chain(table),
  rpc: (fn: string) => chain(undefined, fn),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

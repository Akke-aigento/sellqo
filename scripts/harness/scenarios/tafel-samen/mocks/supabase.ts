// TAFEL-SAMEN-1 — nep-databank: open rekeningen (horeca_snapshot), tafelgroepen (horeca_table_groups) en de
// QR-instellingen. Schrijfacties en RPC's komen in window.__writes; het harnas bewijst opmaak en klikgedrag (R17).
import { areas, categories, closures, pausedUntil, products } from './data';
type Res = { data: unknown; error: null; count?: number };
const q0 = new URLSearchParams(location.search);
const noGroups = q0.get('groups') === 'off';
const H = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const line = (id: string, name: string, cents: number, qty = 1) => ({ id, seq: 1, product_id: null, variant_id: null, name, department_id: 'd', department_name: 'Drank', vat_label: 'A', vat_rate: 21, unit_price_cents: cents, qty, addons: [], price_changes: [], state: 'sent' });
const check = (id: string, table: string, openedH: number, lines: unknown[]) => ({ id, table_id: table, name: null, status: 'open', guests: null, opened_at: H(openedH), bill_requested_at: null, reference: id, version: 1, next_grouping_id: 1, split_of: null, kind: 'table', lines });
const snapshot = { version: 7, checks: [
  check('c8', 'tb8', 30, [line('l1', 'Pils', 280), line('l2', 'Donker abdijbier', 450), line('l3', "Tripel van 't vat", 450), line('l4', 'Wit bier', 350)]),
  check('c2', 'tb2', 0.6, [line('l5', 'Spaghetti bolognese', 1400, 2), line('l6', 'Duvel', 480, 2)]),
  check('c5', 'tb5', 1.2, [line('l7', 'Croque monsieur', 950)]),
] };
const groups = { last_reset: H(8), tables: [
  { table_id: 'tb8', check_id: 'c8', check_opened_at: H(30), stale: true, prev_open_lines: 3, group: { id: 'g8', started_at: H(0.5), last_activity_at: H(0.1) } },
  { table_id: 'tb2', check_id: 'c2', check_opened_at: H(0.6), stale: false, prev_open_lines: 0, group: { id: 'g2', started_at: H(0.62), last_activity_at: H(0.2) } },
  { table_id: 'tb5', check_id: 'c5', check_opened_at: H(1.2), stale: false, prev_open_lines: 0, group: null },
] };
const rows: Record<string, unknown> = {
  tenant_theme_settings: { shop_live: true, shop_ordering: true },
  fulfillment_settings: { tenant_id: 't1', qr_mode: 'order', qr_flow: 'check', qr_auto_accept: false, qr_pay_counter: true, qr_pay_online: false, paused_until: pausedUntil, pay_on_pickup: true,
    qr_call_waiter: true, qr_call_bill: true, qr_block_outside_hours: false, qr_shared_cart: true, qr_group_idle_minutes: 120 },
  horeca_pay_settings: { online_pay: true, online_tip: true, online_split: true },
  horeca_state: { version: 7 },
  business_hours: { week: {}, closures, timezone: 'Europe/Brussels' },
  products, categories, dining_areas: areas, legal_pages: [{ id: 'l1' }], vat_rates: [], pos_terminals: [],
  prep_stations: [{ id: 's1' }, { id: 's2' }],
};
const rpcData: Record<string, unknown> = {
  horeca_snapshot: snapshot,
  horeca_table_groups: noGroups ? null : groups,
  table_group_release: { released: 1, group_id: 'g8' },
  business_hours_close_today: { closed: true },
};
const w = window as unknown as { __writes?: unknown[] };
w.__writes = [];
function chain(table?: string, rpc?: string, args?: unknown): unknown {
  let single = false;
  let head = false;
  const q: Record<string, unknown> = {};
  for (const m of ['eq', 'neq', 'in', 'is', 'not', 'or', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'range', 'delete', 'overlaps', 'contains']) q[m] = () => q;
  q.select = (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return q; };
  q.single = () => { single = true; return q; };
  q.maybeSingle = () => { single = true; return q; };
  for (const m of ['insert', 'update', 'upsert']) q[m] = (v: unknown) => { w.__writes!.push({ table, m, v }); return q; };
  q.then = (ok: (r: Res) => unknown) => {
    if (rpc) {
      w.__writes!.push({ rpc, args });
      if (rpc === 'horeca_table_groups' && noGroups) return Promise.resolve({ data: null, error: { message: 'function does not exist', code: 'PGRST202' } }).then(ok as never);
      return Promise.resolve({ data: rpcData[rpc] ?? null, error: null }).then(ok);
    }
    if (head) return Promise.resolve({ data: null, error: null, count: 0 }).then(ok);
    const r = table ? rows[table] : null;
    const data = single ? (Array.isArray(r) ? r[0] ?? null : r ?? null) : (r == null ? [] : Array.isArray(r) ? r : [r]);
    return Promise.resolve({ data, error: null, count: 8 }).then(ok);
  };
  return q;
}
export const supabase = {
  from: (table: string) => chain(table),
  rpc: (fn: string, args?: unknown) => chain(undefined, fn, args),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

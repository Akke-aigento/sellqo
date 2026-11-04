// UREN-1 — nep-databank: openingsuren (of leeg), afhaal-/leverinstellingen van een bestaande zaak met eigen
// afhaaluren en zonder leveruren, online reserveren zonder eigen uren. Schrijfacties worden gelogd in
// window.__writes (het harnas bewijst opmaak en klikgedrag, geen dataflow).
import { H } from './h';
type Res = { data: unknown; error: null; count?: number };
const week = { 1: [['11:30', '14:00'], ['17:30', '22:00']], 2: [['11:30', '14:00'], ['17:30', '22:00']], 3: [['11:30', '14:00'], ['17:30', '22:00']], 4: [['11:30', '14:00'], ['17:30', '22:00']], 5: [['11:30', '14:00'], ['17:30', '23:00']], 6: [['17:00', '02:00']] };
const today = new Date();
const ymd = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);
const rows: Record<string, unknown> = {
  business_hours: H.hours === 'empty' ? null : { week, closures: [{ from: ymd(20), to: ymd(23), reason: 'Kerstvakantie' }, { from: ymd(40), to: ymd(40), reason: null }], timezone: 'Europe/Brussels' },
  fulfillment_settings: { tenant_id: 't1', slots_enabled: true, slot_minutes: 15, prep_minutes: 20, days_ahead: 1, max_orders_per_slot: null, pay_on_pickup: true, notify_ready: true,
    hours: { pickup: { 2: [['17:00', '21:30']], 3: [['17:00', '21:30']] } }, closed_dates: [], pickup_hours_mode: null, delivery_hours_mode: null, qr_mode: 'order' },
  shipping_methods: [
    { id: 'm1', name: 'Afhalen', price: 0, free_above: null, is_active: true, fulfillment_type: 'pickup', postal_codes: null, min_order_amount: null, description: 'Kerkstraat 1, Leuven' },
    { id: 'm2', name: 'Levering aan huis', price: 2.5, free_above: 30, is_active: true, fulfillment_type: 'local_delivery', postal_codes: ['3000', '3001'], min_order_amount: 15, description: null },
  ],
  reservation_settings: { online_enabled: true, online_hours: {}, slot_minutes: 30, max_guests_per_slot: 20, max_party: 8, days_ahead: 30, min_notice_minutes: 120, online_hours_mode: null, lead_minutes: 60 },
  tenant_theme_settings: { shop_live: true, shop_ordering: true },
  homepage_sections: [],
};
const w = window as unknown as { __writes?: unknown[] };
w.__writes = [];
function chain(table?: string): unknown {
  let single = false;
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'delete']) q[m] = () => q;
  q.single = () => { single = true; return q; };
  q.maybeSingle = () => { single = true; return q; };
  for (const m of ['insert', 'update', 'upsert']) q[m] = (v: unknown) => { w.__writes!.push({ table, m, v }); return q; };
  q.then = (ok: (r: Res) => unknown) => {
    const r = table ? rows[table] : null;
    const data = single ? (Array.isArray(r) ? r[0] ?? null : r ?? null) : (r == null ? [] : Array.isArray(r) ? r : [r]);
    return Promise.resolve({ data: w.__writes!.length && !single && r && !Array.isArray(r) ? [r] : data, error: null, count: 3 }).then(ok);
  };
  return q;
}
export const supabase = {
  from: (table: string) => chain(table),
  rpc: () => chain(),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

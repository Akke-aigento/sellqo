// QR-MODULES-1 — nep-databank per variant. Upserts komen in window.__upserts (gecontroleerd in steps.mjs).
import { V } from './h';
const flow = V === 'order' ? 'order' : 'check';
const fs: Record<string, unknown> = {
  qr_mode: V === 'view' ? 'view' : 'order', qr_flow: flow, qr_auto_accept: false, qr_pay_counter: true, qr_pay_online: false,
  qr_call_waiter: V === 'check' ? false : true, qr_call_bill: true,
};
const pay = { methods: ['cash', 'transfer'], terminal: 'none', kassa_tip: true, online_pay: V === 'check', online_tip: true, online_split: true };
const w = window as unknown as { __upserts: { table: string; row: unknown }[] };
w.__upserts = [];
function chain(table: string): unknown {
  let cols = '';
  const q: Record<string, unknown> = {};
  for (const m of ['eq', 'neq', 'in', 'is', 'order', 'limit', 'single', 'maybeSingle']) q[m] = () => q;
  q.select = (c?: string) => { cols = c ?? ''; return q; };
  q.upsert = (row: unknown) => { w.__upserts.push({ table, row }); return q; };
  q.then = (ok: (r: unknown) => unknown) => {
    // Oudere databank zonder de nieuwe kolommen: die lees faalt (zoals PostgREST 42703).
    if (table === 'fulfillment_settings' && cols.includes('qr_call') && V === 'oldapi') return Promise.resolve({ data: null, error: { message: 'column does not exist' } }).then(ok);
    const data = table === 'fulfillment_settings' ? fs : table === 'horeca_pay_settings' ? pay : table === 'tenant_theme_settings' ? { shop_live: true } : null;
    return Promise.resolve({ data, error: null, count: table === 'pos_terminals' ? (V === 'fiscal' ? 1 : 0) : null }).then(ok);
  };
  return q;
}
export const supabase = {
  from: (table: string) => chain(table),
  rpc: () => chain('rpc'),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

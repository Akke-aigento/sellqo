/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// REKENING-ONLINE-1 — de ECHTE storefront-api-handlers voor table_check_get / table_check_pay /
// table_check_pay_status tegen een nep-databank, en de gedeelde afrond-module
// (_shared/tableCheckPay.ts) met een nep-Stripe. De databankfuncties zelf (bedragen,
// vasthoudingen, afsluiten via horeca_pay) worden live getest op de testwinkel.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/tableCheckPay.test.ts
import { FakeDb } from './fakeSupabase.ts';
import { refundReasonText, settleTableCheckPayment } from '../../supabase/functions/_shared/tableCheckPay.ts';

const T = 'tenant-check';
const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TABLE = '44444444-4444-4444-8444-444444444444';
const PAY = '55555555-5555-4555-8555-555555555555';
const PAY_NEW = '77777777-7777-4777-8777-777777777777';
const PAY_SESSION = '88888888-8888-4888-8888-888888888888';
const db = new FakeDb({
  dining_tables: [{ id: TABLE, tenant_id: T, area_id: 'a1', label: 'Blauw 1', is_active: true, qr_token: TOKEN }],
  dining_areas: [{ id: 'a1', tenant_id: T, name: 'Binnen' }],
  check_online_payments: [{ id: PAY, tenant_id: T, status: 'refunded', kind: 'share', amount_cents: 1200, tip_cents: 100, table_label: 'Blauw 1', reason: 'CHECK_CLOSED', stripe_session_id: null, paid_at: null, created_at: '2026-10-28T12:00:00Z' },
    // FIXES-0711 review B1: een nieuwe poging zonder sessie, en een herhaling waar al een Stripe-sessie aan hangt.
    { id: PAY_NEW, tenant_id: T, status: 'pending', kind: 'full', amount_cents: 2400, tip_cents: 0, table_label: 'Blauw 1', reason: null, stripe_session_id: null, paid_at: null, created_at: '2026-11-07T12:00:00Z' },
    { id: PAY_SESSION, tenant_id: T, status: 'pending', kind: 'full', amount_cents: 2400, tip_cents: 0, table_label: 'Blauw 1', reason: null, stripe_session_id: 'cs_live_1', paid_at: null, created_at: '2026-11-07T12:00:00Z' }],
  tenants: [{ id: T, slug: 'checktest', name: 'Check Test', stripe_account_id: 'acct_x', currency: 'EUR' }],
  tenant_domains: [], tenant_theme_settings: [], fulfillment_settings: [],
});

let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
(db as any).rpc = (fn: string, args: Record<string, unknown>) => {
  rpcCalls.push({ fn, args });
  if (fn === 'table_check_view' || fn === 'table_check_pay_start') return Promise.resolve(rpcResult);
  return Promise.resolve({ data: null, error: null });
};

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, params: Record<string, unknown>) => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', body: JSON.stringify({ action, tenant_id: T, params }) }));
  return { status: r.status, json: await r.json() };
};

Deno.test('rekening: enkel met een tafel uit het zaalplan (QR-token)', async () => {
  rpcCalls.length = 0;
  const free = await call('table_check_get', { table: '4' });
  // Deze winkel heeft een zaalplan: een vrij nummer wordt al bij het opzoeken geweigerd.
  assert(free.json.data?.success === false, JSON.stringify(free.json));
  assert(!rpcCalls.some((c) => c.fn === 'table_check_view'), 'geen rekening zonder tafel');
});

Deno.test('rekening: met QR-token → table_check_view met de tafel-id', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { check: { id: 'c1', total_cents: 2400, lines: [] }, settings: { online_pay: true, tip: true, split: true } }, error: null };
  const r = await call('table_check_get', { table_token: TOKEN });
  assert(r.json.success === true && r.json.data.table_label === 'Blauw 1' && r.json.data.check.total_cents === 2400, JSON.stringify(r.json));
  assert(rpcCalls.find((c) => c.fn === 'table_check_view')?.args.p_table_id === TABLE, JSON.stringify(rpcCalls));
});

Deno.test('betalen: ongeldige invoer → nette fout, geen databankaanroep', async () => {
  rpcCalls.length = 0;
  const base = { table_token: TOKEN, payment_id: PAY, kind: 'full', success_url: 'https://s/ok', cancel_url: 'https://s/no' };
  for (const bad of [{ ...base, payment_id: 'x' }, { ...base, kind: 'alles' }, { ...base, success_url: '' }, { ...base, kind: 'lines', lines: [{ line_id: 'x', qty: 1 }] }]) {
    const r = await call('table_check_pay', bad);
    assert(r.json.data?.error?.code === 'CHECK_PAY_INVALID', JSON.stringify(r.json));
  }
  assert(!rpcCalls.some((c) => c.fn === 'table_check_pay_start'), JSON.stringify(rpcCalls));
});

Deno.test('betalen: databankfout → leesbare melding (iemand betaalt al)', async () => {
  rpcResult = { data: null, error: { message: 'CHECK_PAY_BUSY', code: '55000' } };
  const r = await call('table_check_pay', { table_token: TOKEN, payment_id: PAY, kind: 'share', share_n: 3, share_k: 1, tip_cents: 120, success_url: 'https://s/ok', cancel_url: 'https://s/no' });
  assert(r.json.data?.error?.code === 'CHECK_PAY_BUSY' && /aan het betalen/.test(r.json.data.error.message), JSON.stringify(r.json));
  const a = rpcCalls.filter((c) => c.fn === 'table_check_pay_start').at(-1)?.args ?? {};
  assert(a.p_kind === 'share' && a.p_share_n === 3 && a.p_share_k === 1 && a.p_tip_cents === 120 && a.p_table_id === TABLE, JSON.stringify(a));
});

// FIXES-0711 — een Stripe-fout (foute sleutel/account) gaat nooit letterlijk naar de gast.
Deno.test('betalen: Stripe weigert → ONLINE_PAY_UNAVAILABLE, geen Stripe-tekst, vasthouding vrijgegeven', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { payment_id: PAY_NEW, status: 'pending', amount_cents: 2400, tip_cents: 0, table_label: 'Blauw 1' }, error: null };
  (globalThis as any).__stripeCreateError = Object.assign(new Error("The provided key 'sk_live_***1234' does not have access to account 'acct_1AbCdEfGh'"), { type: 'StripePermissionError', statusCode: 403, raw: {} });
  try {
    const r = await call('table_check_pay', { table_token: TOKEN, payment_id: PAY_NEW, kind: 'full', success_url: 'https://s/ok', cancel_url: 'https://s/no' });
    const txt = JSON.stringify(r.json);
    assert(r.json.data?.error?.code === 'ONLINE_PAY_UNAVAILABLE' && /Vraag de rekening aan de bediening/.test(r.json.data.error.message), txt);
    assert(!/sk_live|acct_|provided key/.test(txt), 'geen Stripe-tekst naar de gast: ' + txt);
    assert(rpcCalls.some((c) => c.fn === 'table_check_pay_mark' && c.args.p_status === 'expired' && c.args.p_payment_id === PAY_NEW), JSON.stringify(rpcCalls));
  } finally {
    delete (globalThis as any).__stripeCreateError;
  }
});

// Review B1: herhaling met een bestaande Stripe-sessie + Stripe laadt niet → nette fout, nooit vrijgeven.
Deno.test('betalen: herhaling met bestaande sessie en Stripe-laadfout → ONLINE_PAY_UNAVAILABLE, geen expired', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { payment_id: PAY_SESSION, status: 'pending', amount_cents: 2400, tip_cents: 0, table_label: 'Blauw 1', stripe_session_id: 'cs_live_1', duplicate: true }, error: null };
  (globalThis as any).__stripeLoadError = new Error('Invalid API Key provided: sk_live_***');
  try {
    const r = await call('table_check_pay', { table_token: TOKEN, payment_id: PAY_SESSION, kind: 'full', success_url: 'https://s/ok', cancel_url: 'https://s/no' });
    assert(r.json.data?.error?.code === 'ONLINE_PAY_UNAVAILABLE', JSON.stringify(r.json));
    assert(!rpcCalls.some((c) => c.fn === 'table_check_pay_mark'), 'niet vrijgeven: ' + JSON.stringify(rpcCalls));
  } finally {
    delete (globalThis as any).__stripeLoadError;
  }
});

// Review B1: ook zonder duplicaatvlag geeft het vangnet een poging met een sessie nooit vrij.
Deno.test('betalen: sessie maken faalt maar de poging heeft al een sessie → geen expired', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { payment_id: PAY_SESSION, status: 'pending', amount_cents: 2400, tip_cents: 0, table_label: 'Blauw 1' }, error: null };
  (globalThis as any).__stripeCreateError = new Error('boom');
  try {
    const r = await call('table_check_pay', { table_token: TOKEN, payment_id: PAY_SESSION, kind: 'full', success_url: 'https://s/ok', cancel_url: 'https://s/no' });
    assert(r.json.data?.error?.code === 'ONLINE_PAY_UNAVAILABLE', JSON.stringify(r.json));
    assert(!rpcCalls.some((c) => c.fn === 'table_check_pay_mark'), 'niet vrijgeven: ' + JSON.stringify(rpcCalls));
  } finally {
    delete (globalThis as any).__stripeCreateError;
  }
});

Deno.test('status: teruggestort → leesbare reden; onbekend → NOT_FOUND', async () => {
  const ok = await call('table_check_pay_status', { payment_id: PAY });
  assert(ok.json.data?.status === 'refunded' && ok.json.data.reason === refundReasonText('CHECK_CLOSED'), JSON.stringify(ok.json));
  const nf = await call('table_check_pay_status', { payment_id: '66666666-6666-4666-8666-666666666666' });
  assert(nf.json.data?.error?.code === 'NOT_FOUND', JSON.stringify(nf.json));
});

Deno.test('GET-stempel storefront-api (FIXES-0711)', async () => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'GET' }));
  assert((await r.json()).version === 'FIXES-0711', 'stempel');
});

// --- afrond-module ------------------------------------------------------------------------------
const settleDb = (answer: unknown, notifyChanged = true) => {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];
  return {
    calls, inserts,
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve({ data: fn === 'table_check_pay_settle' ? answer : String(args.p_status).startsWith('notify') ? { status: 'refunded', changed: notifyChanged } : { status: 'refunded', changed: true }, error: null }); },
    from: (_t: string) => ({ insert: (row: Record<string, unknown>) => { inserts.push(row); return Promise.resolve({ error: null }); } }),
  };
};
const input = { paymentId: PAY, tenantId: T, amountTotalCents: 1300, paymentIntent: 'pi_1', stripeAccount: 'acct_x', tableLabel: 'Blauw 1' };

Deno.test('afronden: betaald → geen terugstorting, geen melding', async () => {
  const d = settleDb({ ok: true, status: 'paid', closed: true });
  let refunds = 0;
  const o = await settleTableCheckPayment(d, { refunds: { create: () => { refunds++; return Promise.resolve({ id: 're_1' }); } } }, input);
  assert(o.status === 'paid' && refunds === 0 && d.inserts.length === 0, JSON.stringify(o));
});

Deno.test('afronden: klopt niet meer → terugstorten op het connected account, status refunded, melding', async () => {
  const d = settleDb({ ok: false, refund: true, status: 'refund_needed', reason: 'CHECK_CLOSED' });
  const seen: { params: Record<string, unknown>; opts: { stripeAccount: string; idempotencyKey?: string } }[] = [];
  const o = await settleTableCheckPayment(d, { refunds: { create: (params, opts) => { seen.push({ params, opts }); return Promise.resolve({ id: 're_9' }); } } }, input);
  assert(o.status === 'refunded' && seen[0].params.payment_intent === 'pi_1' && seen[0].params.refund_application_fee === true && seen[0].opts.stripeAccount === 'acct_x' && seen[0].opts.idempotencyKey === `table_check_refund_${PAY}`, JSON.stringify(seen));
  assert(d.calls.some((c) => c.fn === 'table_check_pay_mark' && c.args.p_status === 'refunded' && c.args.p_refund_id === 're_9'), JSON.stringify(d.calls));
  assert(d.inserts[0]?.category === 'payments' && d.inserts[0]?.type === 'table_check_refunded', JSON.stringify(d.inserts));
  // HORECA-INSTELLINGEN-1b: de melding opent Transacties (bestaat voor elk spoor), niet de kassa-instellingen.
  assert(d.inserts[0]?.action_url === '/admin/payments', JSON.stringify(d.inserts));
});

Deno.test('afronden: terugstorten mislukt → refund_needed blijft, melding met hoge prioriteit', async () => {
  const d = settleDb({ ok: false, refund: true, status: 'refund_needed', reason: 'CHECK_CHANGED' });
  const o = await settleTableCheckPayment(d, { refunds: { create: () => Promise.reject(new Error('stripe down')) } }, input);
  assert(o.status === 'refund_needed' && d.inserts[0]?.type === 'table_check_refund_failed' && d.inserts[0]?.priority === 'high', JSON.stringify({ o, i: d.inserts }));
  assert(!d.calls.some((c) => c.fn === 'table_check_pay_mark' && c.args.p_status === 'refunded'), 'geen refunded zonder terugstorting');
});

Deno.test('afronden twee keer (webhook + gast): één melding', async () => {
  const d = settleDb({ ok: false, refund: true, status: 'refund_needed', reason: 'CHECK_CLOSED' }, false);
  const o = await settleTableCheckPayment(d, { refunds: { create: () => Promise.resolve({ id: 're_9' }) } }, input);
  assert(o.status === 'refunded' && d.inserts.length === 0, JSON.stringify({ o, i: d.inserts }));
});

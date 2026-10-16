/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// SUB-UNIFY-2A — rooktest van de ECHTE subscription-lifecycle-sweep-handler tegen een
// thenable nep-databank, met de live-toestand van 16-10-2026 (query_database, 09:39 UTC)
// plus twee verzonnen klanten (één opgezegd en verlopen, één opgezegd en nog lopend).
//
// Bewijst: standaard dry-run schrijft niets; de echte modus raakt alleen de verlopen
// opgezegde klant; demo's, eigen winkels, Sander's winkels (billing_on_hold) en SellQo
// zelf blijven ongemoeid; billing_cycles worden nooit aangeraakt.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/lifecycle-sweep.test.ts
import { FakeDb } from './fakeSupabase.ts';

const plan = (id: string, m: number, y: number) => ({ id, slug: id, monthly_price: m, yearly_price: y });
const PLANS: Record<string, any> = {
  starter: plan('starter', 29, 290), pro: plan('pro', 79, 790), enterprise: plan('enterprise', 199, 1990),
  free: plan('free', 0, 0), events_flex: plan('events_flex', 0, 0),
};
const ts = (tenant_id: string, t: Record<string, unknown>, p: string, extra: Record<string, unknown> = {}) => ({
  tenant_id, plan_id: p, status: 'active', current_period_end: null, trial_end: null, cancel_at_period_end: false,
  pending_plan_id: null, billing_subscription_id: null,
  tenants: { is_demo: false, is_internal_tenant: false, billing_exempt: false, billing_on_hold: false, ...t },
  pricing_plan: PLANS[p], ...extra,
});

const FUTURE = new Date(Date.now() + 20 * 86400000).toISOString();
const PAST = new Date(Date.now() - 3 * 86400000).toISOString();

const db = new FakeDb({
  tenant_subscriptions: [
    // live 16-10
    ts('astra', { name: 'Astra Sleep', slug: 'astra-sleep' }, 'starter', { current_period_end: '2026-10-01T00:00:00+00:00', billing_subscription_id: 'sub-astra' }),
    ts('speeltuin', { name: 'SellQo Speeltuin', slug: 'sellqo-speeltuin', is_demo: true }, 'pro', { current_period_end: '2026-09-05T00:00:00+00:00', trial_end: '2026-08-19T11:07:30Z', billing_subscription_id: 'sub-speeltuin' }),
    ts('sandbox', { name: 'SellQo Sandbox', slug: 'sandbox', is_demo: true }, 'starter', { current_period_end: '2026-08-09T00:00:00+00:00', billing_subscription_id: 'sub-sandbox' }),
    ts('mancini', { name: 'Mancini Milano', slug: 'mancini-milano', billing_on_hold: true }, 'starter', { current_period_end: '2026-10-27T09:44:20Z', trial_end: '2026-10-27T09:44:20Z' }),
    ts('loveke', { name: 'Loveke', slug: 'loveke', billing_exempt: true }, 'starter', { current_period_end: '2026-11-10T08:39:01Z' }),
    ts('sellqo', { name: 'SellQo', slug: 'sellqo', is_internal_tenant: true }, 'enterprise', { current_period_end: '2126-03-10T08:24:32Z' }),
    ts('fonske', { name: 'The Fonske Crawl', slug: 'fonske-crawl', billing_exempt: true }, 'free'),
    // verzonnen
    ts('klant-weg', { name: 'Klant opgezegd', slug: 'klant-weg' }, 'pro', { current_period_end: PAST, cancel_at_period_end: true, pending_plan_id: 'free', billing_subscription_id: 'sub-weg' }),
    ts('klant-loopt', { name: 'Klant loopt nog', slug: 'klant-loopt' }, 'starter', { current_period_end: FUTURE, cancel_at_period_end: true, pending_plan_id: 'free', billing_subscription_id: 'sub-loopt' }),
    ts('klant-sander-oud', { name: 'Klant on hold, oude opzegging', slug: 'klant-hold', billing_on_hold: true }, 'starter', { current_period_end: PAST, status: 'canceled' }),
  ],
  subscriptions: [
    { id: 'sub-astra', status: 'active' }, { id: 'sub-speeltuin', status: 'cancelled' }, { id: 'sub-sandbox', status: 'cancelled' },
    { id: 'sub-weg', status: 'active' }, { id: 'sub-loopt', status: 'active' },
  ],
  billing_cycles: [
    { id: 'cy-weg', subscription_id: 'sub-weg', status: 'awaiting_payment', invoice_id: null },
  ],
  tenants: [], notifications: [], internal_config: [],
});
(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service');
await import('../../supabase/functions/subscription-lifecycle-sweep/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const post = async (body: unknown, auth = 'Bearer test-service') => {
  const r = await handler(new Request('https://f/subscription-lifecycle-sweep', {
    method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body),
  }));
  return { status: r.status, body: await r.json() };
};
const byTenant = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.tenant_id, r]));

Deno.test('GET geeft de versiestempel', async () => {
  const r = await handler(new Request('https://f/subscription-lifecycle-sweep'));
  const b = await r.json();
  assert(r.status === 200 && b.version === 'SUB-UNIFY-2A', JSON.stringify(b));
});

Deno.test('zonder service-key of cron-secret: 401, niets gelezen of geschreven', async () => {
  db.writes.length = 0;
  const r = await post({ dry_run: false }, '');
  assert(r.status === 401, JSON.stringify(r));
  assert(db.writes.length === 0, 'writes');
});

Deno.test('lege body = dry-run: lijst, maar geen enkele write', async () => {
  db.writes.length = 0;
  const r = await post({});
  assert(r.status === 200 && r.body.dry_run === true, JSON.stringify(r.body));
  const m = byTenant(r.body.rows);
  assert(m['klant-weg'].action === 'downgrade', 'klant-weg');
  assert(m['klant-weg'].open_cycles === 1, 'open cyclus gemeld');
  assert(m['klant-loopt'].action === 'scheduled', 'klant-loopt');
  assert(m['speeltuin'].action === 'excluded' && m['speeltuin'].reason === 'demo', 'speeltuin');
  assert(m['sandbox'].action === 'excluded' && m['sandbox'].reason === 'demo', 'sandbox');
  assert(m['klant-sander-oud'].action === 'excluded' && m['klant-sander-oud'].reason === 'on_hold', 'on hold');
  for (const id of ['astra', 'mancini', 'loveke', 'sellqo', 'fonske']) assert(!m[id], `${id} hoort niet in de lijst`);
  assert(r.body.downgrade === 1 && r.body.applied === 0, JSON.stringify(r.body));
  assert(db.writes.length === 0, `dry-run schreef: ${JSON.stringify(db.writes)}`);
});

Deno.test('ook de cron-body {"dry_run":true} en een onzinwaarde schrijven niets', async () => {
  db.writes.length = 0;
  for (const b of [{ source: 'cron', dry_run: true }, { dry_run: 'false' }, { dry_run: 0 }]) {
    const r = await post(b);
    assert(r.body.dry_run === true, JSON.stringify(b));
  }
  assert(db.writes.length === 0, 'writes');
});

Deno.test('echte modus raakt alleen de verlopen opgezegde klant, en nooit billing_cycles', async () => {
  db.writes.length = 0;
  const r = await post({ dry_run: false });
  assert(r.status === 200 && r.body.dry_run === false && r.body.applied === 1, JSON.stringify(r.body));
  const touched = new Set(db.writes.map((w: any) => w.where?.tenant_id ?? w.where?.id ?? w.insert?.tenant_id));
  assert(touched.size === 2 && touched.has('klant-weg') && touched.has('sub-weg') && db.writes.length === 4, JSON.stringify(db.writes));
  const tsW: any = db.writes.find((w: any) => w.table === 'tenant_subscriptions');
  assert(tsW.patch.plan_id === 'free' && tsW.where.plan_id === 'pro', JSON.stringify(tsW));
  const subW: any = db.writes.find((w: any) => w.table === 'subscriptions');
  assert(subW.patch.status === 'cancelled' && subW.where.status === 'active', JSON.stringify(subW));
  const tW: any = db.writes.find((w: any) => w.table === 'tenants');
  assert(tW.patch.subscription_plan === 'free', JSON.stringify(tW));
  const n: any = db.writes.find((w: any) => w.table === 'notifications');
  assert(n.insert.category === 'subscriptions' && n.insert.type === 'plan_ended' && n.insert.action_url === '/admin/billing', JSON.stringify(n));
  assert(!db.writes.some((w: any) => w.table === 'billing_cycles' || w.table === 'invoices'), 'geen cycli/facturen');
});

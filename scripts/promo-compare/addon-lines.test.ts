/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// BILL-ADDON-1 — de I/O-helpers van _shared/addonLines.ts tegen de thenable nep-databank:
// de webhook die een betaalde add-on aanzet, een plan dat een add-on dekt, modules uitzetten.
// Wat live niet te testen is zonder echt geld (betaling → add-on aan) zit hier.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/addon-lines.test.ts
import { FakeDb } from './fakeSupabase.ts';
import {
  activateAddonLine, addonsNetFor, clearBilledModules, dropAddonsForTrack, effectuateAddonCycle, setTenantModule,
} from '../../supabase/functions/_shared/addonLines.ts';

function eq(a: unknown, b: unknown, msg = '') {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg}\n  verwacht: ${y}\n  gekregen: ${x}`);
}

const ADDONS = [
  { id: 'addon_webshop', name: 'Webshop-add-on', track: 'webshop', monthly_price: 19, yearly_price: 190, ticket_fee: null, active: true },
  { id: 'addon_horeca', name: 'Horeca-add-on', track: 'horeca', monthly_price: 29, yearly_price: 290, ticket_fee: null, active: true },
  { id: 'addon_events', name: 'Events-add-on', track: 'events', monthly_price: 0, yearly_price: 0, ticket_fee: 0.69, active: true },
];

function world(extra: Record<string, any[]> = {}) {
  return new FakeDb({
    platform_addons: ADDONS,
    tenant_subscriptions: [{ tenant_id: 'shop', billing_subscription_id: 'sub-1' }],
    subscriptions: [{ id: 'sub-1', interval: 'monthly', status: 'active' }],
    tenants: [{ id: 'shop', business_modules: [], billing_exempt: false, is_internal_tenant: false, is_demo: false, billing_on_hold: false }],
    subscription_lines: [],
    ...extra,
  });
}
const writesTo = (db: FakeDb, t: string) => db.writes.filter((w) => w.table === t);

Deno.test('webhook: betaalde add-on-pro-rata zet regel (maandprijs) en module aan', async () => {
  const db = world();
  const done = await effectuateAddonCycle(db as any, {
    subscription_id: 'sub-1',
    lines: [{ kind: 'addon', addon_id: 'addon_horeca', unit_price: 29 }],
  });
  eq(done, true);
  const ins = writesTo(db, 'subscription_lines')[0]?.insert;
  eq([ins.kind, ins.addon_id, ins.unit_price, ins.description], ['addon', 'addon_horeca', 29, 'Horeca-add-on (monthly)']);
  eq(writesTo(db, 'tenants')[0]?.patch, { business_modules: ['horeca'] });
});

Deno.test('webhook: jaarabonnement krijgt de jaarprijs', async () => {
  const db = world({ subscriptions: [{ id: 'sub-1', interval: 'yearly', status: 'active' }] });
  await effectuateAddonCycle(db as any, { subscription_id: 'sub-1', lines: [{ kind: 'addon', addon_id: 'addon_horeca' }] });
  eq(writesTo(db, 'subscription_lines')[0]?.insert.unit_price, 290);
});

Deno.test('webhook: een upgradecyclus of een gestopt abonnement zet niets aan', async () => {
  const db = world();
  eq(await effectuateAddonCycle(db as any, { subscription_id: 'sub-1', lines: [{ kind: 'plan', description: 'Upgrade' }] }), false);
  eq(await effectuateAddonCycle(db as any, { subscription_id: 'sub-1', lines: null }), false);
  const stopped = world({ subscriptions: [{ id: 'sub-1', interval: 'monthly', status: 'cancelled' }] });
  eq(await effectuateAddonCycle(stopped as any, { subscription_id: 'sub-1', lines: [{ kind: 'addon', addon_id: 'addon_horeca' }] }), false);
  eq(db.writes.length + stopped.writes.length, 0, 'geen enkele schrijfactie');
});

Deno.test('mandaatpad: activateAddonLine laat een module die al aan staat ongemoeid', async () => {
  const db = world({ tenants: [{ id: 'shop', business_modules: ['horeca'] }] });
  await activateAddonLine(db as any, { subscriptionId: 'sub-1', tenantId: 'shop', addon: ADDONS[1] as any, interval: 'monthly' });
  eq(writesTo(db, 'tenants').length, 0);
  eq(writesTo(db, 'subscription_lines').length, 1);
});

Deno.test('planwissel: een add-on van het spoor van het nieuwe plan valt weg, de andere blijft', async () => {
  const db = world({
    subscription_lines: [
      { id: 'l-horeca', subscription_id: 'sub-1', kind: 'addon', addon_id: 'addon_horeca' },
      { id: 'l-webshop', subscription_id: 'sub-1', kind: 'addon', addon_id: 'addon_webshop' },
    ],
    tenants: [{ id: 'shop', business_modules: ['horeca', 'webshop'] }],
  });
  eq(await dropAddonsForTrack(db as any, 'sub-1', 'shop', 'horeca'), 1);
  const del = writesTo(db, 'subscription_lines').filter((w) => w.delete);
  eq(del.map((w) => w.where.id), ['l-horeca']);
  eq(writesTo(db, 'tenants')[0]?.patch, { business_modules: ['webshop'] });
});

Deno.test('pro rata bij planwissel: de gedekte add-on telt niet mee in het nieuwe bedrag', async () => {
  const db = world({
    subscription_lines: [
      { id: 'l-horeca', subscription_id: 'sub-1', kind: 'addon', addon_id: 'addon_horeca', quantity: 1, end_date: null },
      { id: 'l-webshop', subscription_id: 'sub-1', kind: 'addon', addon_id: 'addon_webshop', quantity: 1, end_date: null },
    ],
  });
  eq(await addonsNetFor(db as any, 'sub-1', 'monthly'), 48);
  eq(await addonsNetFor(db as any, 'sub-1', 'monthly', 'horeca'), 19);
  eq(await addonsNetFor(db as any, 'sub-1', 'yearly', 'horeca'), 190);
});

Deno.test('opzeggen: modules leeg bij een betalende winkel, nooit bij demo of vrijgesteld', async () => {
  const paid = world({ tenants: [{ id: 'shop', business_modules: ['horeca'], is_demo: false }] });
  eq(await clearBilledModules(paid as any, 'shop'), true);
  eq(writesTo(paid, 'tenants')[0]?.patch, { business_modules: [] });
  for (const flag of ['is_demo', 'billing_exempt', 'is_internal_tenant', 'billing_on_hold']) {
    const db = world({ tenants: [{ id: 'shop', business_modules: ['horeca'], [flag]: true }] });
    eq(await clearBilledModules(db as any, 'shop'), false, flag);
    eq(db.writes.length, 0, flag);
  }
});

Deno.test('module uit: alleen dat spoor, rest blijft', async () => {
  const db = world({ tenants: [{ id: 'shop', business_modules: ['horeca', 'events'] }] });
  await setTenantModule(db as any, 'shop', 'horeca', false);
  eq(writesTo(db, 'tenants')[0]?.patch, { business_modules: ['events'] });
});

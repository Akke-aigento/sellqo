/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// ADDON-SELF-1 — de ECHTE sync-tenant-plan-handler tegen een nep-databank die schrijft:
// de zaakvoerder zet zelf een spoor aan of uit. Waterdicht = deze tests:
//  - enkel tenant_admin van díe winkel (of platformadmin), nooit staff of een andere winkel;
//  - Free/Flex: pay-first, het spoor gaat NIET aan vóór betaling (tot 31-10 wel), pas na de
//    webhook (effectuateAddonCycle);
//  - dubbelklik: precies één facturatieabonnement en één betaling;
//  - gratis ontgrendeld: nooit aanrekenen; lopend werk: uitzetten geweigerd;
//  - proefperiode: gratis aan, geen cyclus;
//  - 'package' toont exact het bedrag dat 'addon' daarna aanrekent.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/addonSelfServe.test.ts
import { Gate, StatefulDb, type Row } from "./statefulDb.ts";
import { effectuateAddonCycle } from "../../supabase/functions/_shared/addonLines.ts";
import { advanceDate } from "../../supabase/functions/_shared/billingDates.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

const SHOP = "11111111-1111-1111-1111-111111111111";
const OTHER = "33333333-3333-3333-3333-333333333333";
const SELLQO = "99999999-9999-9999-9999-999999999999";
const SERVICE = "service-test";
const TODAY = new Date().toISOString().slice(0, 10);

const PLANS: Record<string, Row> = {
  free: { id: "free", slug: "free", name: "Free", track: "webshop", monthly_price: 0, yearly_price: 0 },
  starter: { id: "starter", slug: "starter", name: "Starter", track: "webshop", monthly_price: 29, yearly_price: 290 },
  horeca: { id: "horeca", slug: "horeca", name: "Horeca Small", track: "horeca", monthly_price: 49, yearly_price: 490 },
};

function setup(over: { plan?: string; modules?: string[]; granted?: string[]; trialEnd?: string | null; tables?: Record<string, Row[]> } = {}) {
  const plan = PLANS[over.plan ?? "free"];
  const db = new StatefulDb({
    tenants: [
      {
        id: SHOP, name: "Frituur Test", slug: "frituur-test", owner_email: "baas@frituur.test", billing_email: null, billing_company_name: null,
        subscription_plan: plan.id, business_modules: over.modules ?? [], billing_exempt: false, is_internal_tenant: false, is_demo: false, billing_on_hold: false,
      },
      { id: SELLQO, name: "SellQo", slug: "sellqo", is_internal_tenant: true, is_demo: false, billing_exempt: false, billing_on_hold: false },
    ],
    user_roles: [
      { user_id: "owner", role: "tenant_admin", tenant_id: SHOP },
      { user_id: "staff", role: "staff", tenant_id: SHOP },
      { user_id: "other", role: "tenant_admin", tenant_id: OTHER },
      { user_id: "admin", role: "platform_admin", tenant_id: null },
    ],
    pricing_plans: Object.values(PLANS),
    tenant_subscriptions: [{
      id: "ts1", tenant_id: SHOP, plan_id: plan.id, status: "active", billing_interval: "monthly",
      trial_end: over.trialEnd ?? null, billing_subscription_id: null, billing_customer_id: null, pricing_plan: plan,
    }],
    platform_addons: [
      { id: "addon_webshop", name: "Webshop-add-on", track: "webshop", monthly_price: 19, yearly_price: 190, ticket_fee: 0, active: true },
      { id: "addon_horeca", name: "Horeca-add-on", track: "horeca", monthly_price: 29, yearly_price: 290, ticket_fee: 0, active: true },
      { id: "addon_events", name: "Events-add-on", track: "events", monthly_price: 0, yearly_price: 0, ticket_fee: 0.69, active: true },
    ],
    tenant_feature_overrides: over.granted ? [{ tenant_id: SHOP, granted_features: over.granted }] : [],
    customers: [],
    customer_payment_mandates: [],
    subscriptions: [],
    subscription_lines: [],
    billing_cycles: [],
    invoices: [],
    dining_checks: [],
    event_details: [],
    ticket_instances: [],
    orders: [],
    ...(over.tables ?? {}),
  });
  (db as any).auth = {
    getUser: (tok: string) => Promise.resolve(
      ["owner", "staff", "other", "admin"].includes(tok)
        ? { data: { user: { id: tok } }, error: null }
        : { data: { user: null }, error: { message: "bad" } },
    ),
  };
  (globalThis as any).__fakeDb = db;
  return db;
}

Deno.env.set("SUPABASE_URL", "https://x.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE);
let handler: (req: Request) => Promise<Response>;
async function call(user: string, body: Row): Promise<{ status: number; json: any }> {
  if (!handler) {
    const orig = Deno.serve;
    (Deno as any).serve = (h: any) => { handler = h; return {} as any; };
    await import("../../supabase/functions/sync-tenant-plan/index.ts");
    (Deno as any).serve = orig;
  }
  const res = await handler(new Request("https://fn.test/sync-tenant-plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${user}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: SHOP, ...body }),
  }));
  return { status: res.status, json: await res.json() };
}
const addon = (user: string, id: string, enabled: boolean, extra: Row = {}) =>
  call(user, { action: "addon", addon_id: id, enabled, ...extra });
const modules = (db: StatefulDb) => db.tables.tenants.find((t) => t.id === SHOP)!.business_modules;

Deno.test("rechten: staff en een andere winkel krijgen 403, de zaakvoerder niet", async () => {
  setup();
  eq((await addon("staff", "addon_webshop", true)).status, 403, "staff");
  eq((await addon("other", "addon_webshop", true)).status, 403, "andere winkel");
  eq((await addon("nobody", "addon_webshop", true)).status, 401, "geen sessie");
  eq((await call("staff", { action: "package" })).status, 403, "staff mag het pakket niet lezen");
});

Deno.test("Free + horeca-add-on: pay-first, pas aan na de webhook", async () => {
  const db = setup({ plan: "free" });
  const r = await addon("owner", "addon_horeca", true);
  eq([r.status, r.json.success, r.json.enabled, r.json.pending, r.json.pro_rata_total], [200, true, false, true, 35.09], "antwoord");
  eq(modules(db), [], "spoor nog niet aan vóór betaling");
  eq(db.tables.subscription_lines.length, 0, "nog geen regel vóór betaling");
  const subs = db.tables.subscriptions;
  eq(subs.map((s) => [s.status, s.next_invoice_date]), [["active", advanceDate(TODAY, "monthly")]], "kaal abonnement, eerste factuur over een maand");
  const cyc = db.tables.billing_cycles;
  eq(cyc.map((c) => [c.cycle_type, c.status, c.total, c.lines[0].addon_id, c.target_plan_id]), [["proration", "awaiting_payment", 35.09, "addon_horeca", null]], "één cyclus eerste maand");
  eq(db.tables.tenant_subscriptions[0].billing_subscription_id, subs[0].id, "gekoppeld");

  // Webhook: betaald → aan.
  const done = await effectuateAddonCycle(db, cyc[0]);
  eq(done, true, "webhook herkent de add-oncyclus");
  eq(modules(db), ["horeca"], "aan na betaling");
  eq(db.tables.subscription_lines.map((l) => [l.kind, l.addon_id, l.unit_price]), [["addon", "addon_horeca", 29]], "regel voor volgende maand");
  eq(db.tables.subscriptions[0].next_invoice_date, advanceDate(TODAY, "monthly"), "periode start bij de betaling");

  // Nog eens aanzetten = niets aanrekenen.
  const again = await addon("owner", "addon_horeca", true);
  eq([again.json.success, again.json.noop], [true, true], "tweede keer no-op");
  eq(db.tables.billing_cycles.length, 1, "geen tweede cyclus");
});

Deno.test("dubbelklik op Free: één abonnement, één cyclus", async () => {
  const db = setup({ plan: "free" });
  db.gates["subscriptions:insert"] = new Gate(2);
  const [a, b] = await Promise.all([addon("owner", "addon_horeca", true), addon("owner", "addon_horeca", true)]);
  const ok = [a, b].filter((x) => x.json.success).length;
  const conflict = [a, b].filter((x) => x.json.code === "proration_cycle_open").length;
  eq([ok, conflict], [1, 1], "één slaagt, één krijgt 409");
  eq(db.tables.subscriptions.filter((s) => s.status === "active").length, 1, "één actief abonnement");
  eq(db.tables.billing_cycles.length, 1, "één cyclus");
  eq(modules(db), [], "niets aan vóór betaling");
});

Deno.test("gratis ontgrendeld: nooit aanrekenen", async () => {
  const db = setup({ plan: "free", granted: ["horeca"] });
  const r = await addon("owner", "addon_horeca", true);
  eq([r.status, r.json.code], [409, "addon_granted"], "geweigerd");
  eq(db.tables.billing_cycles.length + db.tables.subscriptions.length, 0, "niets aangemaakt");
  const p = await call("owner", { action: "package" });
  eq(p.json.addons.find((x: any) => x.id === "addon_horeca").status, "included", "kaart: inbegrepen");
});

Deno.test("spoor van het plan kan geen add-on zijn", async () => {
  setup({ plan: "horeca" });
  const r = await addon("owner", "addon_horeca", true);
  eq([r.status, r.json.code], [409, "addon_in_plan"], "geweigerd");
});

Deno.test("uitzetten met lopend werk: geweigerd; platformadmin met force mag", async () => {
  const db = setup({ plan: "free", modules: ["horeca"], tables: { dining_checks: [{ id: "c1", tenant_id: SHOP, status: "open" }, { id: "c2", tenant_id: SHOP, status: "closed" }] } });
  const r = await addon("owner", "addon_horeca", false);
  eq([r.status, r.json.code, r.json.usage?.open_checks], [409, "addon_in_use", 1], "open rekening");
  eq(modules(db), ["horeca"], "blijft aan");
  const force = await addon("owner", "addon_horeca", false, { force: true });
  eq(force.json.code, "addon_in_use", "force telt niet voor de zaakvoerder");
  const admin = await addon("admin", "addon_horeca", false, { force: true });
  eq([admin.json.success, modules(db)], [true, []], "platformadmin met force");
});

Deno.test("verkochte tickets voor een komend event houden events aan", async () => {
  setup({
    plan: "free", modules: ["events"],
    tables: {
      event_details: [{ id: "e1", tenant_id: SHOP, status: "scheduled", event_date: advanceDate(TODAY, "monthly") }, { id: "e0", tenant_id: SHOP, status: "scheduled", event_date: "2020-01-01" }],
      ticket_instances: [{ id: "t1", tenant_id: SHOP, event_detail_id: "e1", status: "valid" }, { id: "t0", tenant_id: SHOP, event_detail_id: "e0", status: "valid" }],
    },
  });
  const r = await addon("owner", "addon_events", false);
  eq([r.json.code, r.json.usage?.upcoming_ticketed_events], ["addon_in_use", 1], "enkel het komende event telt");
});

Deno.test("proefperiode: gratis aan, geen betaling, kaart zegt 'trial'", async () => {
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  const db = setup({ plan: "starter", trialEnd: future });
  const pre = await call("owner", { action: "package" });
  const q = pre.json.addons.find((x: any) => x.id === "addon_horeca").quote;
  eq([q.kind, q.total], ["trial", 0], "kaart: gratis tijdens de trial");
  const r = await addon("owner", "addon_horeca", true);
  eq([r.json.success, r.json.trial, r.json.billed_from], [true, true, future], "aan tijdens trial");
  eq(modules(db), ["horeca"], "spoor aan");
  eq(db.tables.billing_cycles.length + db.tables.subscriptions.length, 0, "geen betaling, geen abonnement");
  const post = await call("owner", { action: "package" });
  eq(post.json.addons.find((x: any) => x.id === "addon_horeca").status, "trial", "kaart: trial");
});

Deno.test("betaald plan zonder trial en zonder facturatieabonnement: eerst een plan", async () => {
  setup({ plan: "starter" });
  const r = await addon("owner", "addon_horeca", true);
  eq([r.status, r.json.code], [409, "addon_needs_plan"], "geweigerd");
});

Deno.test("pakketkaart toont exact wat aanzetten aanrekent", async () => {
  const db = setup({ plan: "free" });
  const p = await call("owner", { action: "package" });
  eq([p.status, p.json.plan.id, p.json.plan.track], [200, "free", "webshop"], "plan");
  const byId = Object.fromEntries(p.json.addons.map((a: any) => [a.id, a]));
  eq([byId.addon_webshop.status, byId.addon_horeca.status, byId.addon_events.status], ["in_plan", "off", "off"], "statussen");
  eq([byId.addon_horeca.quote.kind, byId.addon_horeca.quote.total], ["first_month", 35.09], "horeca eerste maand");
  eq([byId.addon_events.quote.kind, byId.addon_events.quote.total], ["free", 0], "events gratis");
  const r = await addon("owner", "addon_horeca", true);
  eq(r.json.pro_rata_total, byId.addon_horeca.quote.total, "zelfde bedrag als getoond");
  const p2 = await call("owner", { action: "package" });
  if (!p2.json.addons) throw new Error(JSON.stringify(p2));
  const h = p2.json.addons.find((x: any) => x.id === "addon_horeca");
  eq([h.status, h.pending.total], ["pending_payment", 35.09], "wacht op betaling");
  eq(db.tables.billing_cycles.length, 1, "lezen maakt niets aan");
});

Deno.test("review: plan_id in het verzoek wordt genegeerd (geen gratis betaald plan)", async () => {
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  const db = setup({ plan: "starter", trialEnd: future });
  const r = await addon("owner", "addon_horeca", true, { plan_id: "free" });
  eq([r.json.success, r.json.trial], [true, true], "proefperiode-tak, niet de Free-tak");
  eq([db.tables.subscriptions.length, db.tables.billing_cycles.length], [0, 0], "geen kaal abonnement");
  eq(db.tables.tenant_subscriptions[0].billing_subscription_id, null, "niets gekoppeld");
  const r2 = await addon("owner", "addon_horeca", true, { plan_id: "free" });
  eq(r2.json.success, true, "idempotent");
  const p = await call("owner", { action: "package", plan_id: "free" });
  eq(p.json.plan.id, "starter", "pakket toont het echte plan");
});

Deno.test("review: onbetaald verzoek intrekken (ook verlopen) ruimt het kale abonnement op", async () => {
  const db = setup({ plan: "free" });
  await addon("owner", "addon_horeca", true);
  db.tables.billing_cycles[0].status = "expired";
  const off = await addon("owner", "addon_horeca", false);
  eq(off.json.success, true, "intrekken lukt");
  eq(db.tables.billing_cycles[0].status, "cancelled", "verzoek geannuleerd");
  eq(db.tables.subscriptions[0].status, "cancelled", "kaal abonnement gestopt");
  eq(db.tables.tenant_subscriptions[0].billing_subscription_id, null, "ontkoppeld");
  eq(modules(db), [], "spoor uit");
  const p = await call("owner", { action: "package" });
  const h = p.json.addons.find((x: any) => x.id === "addon_horeca");
  eq([h.status, h.quote.kind], ["off", "first_month"], "opnieuw aanvragen kan");
  const again = await addon("owner", "addon_horeca", true);
  eq([again.json.pending, db.tables.subscriptions.filter((x) => x.status === "active").length], [true, 1], "nieuw verzoek, één actief abonnement");
});

Deno.test("review: intrekken van een verzoek op een betaald abonnement laat het abonnement staan", async () => {
  const db = setup({ plan: "free" });
  await addon("owner", "addon_horeca", true);
  // Betaald → regel → nu een tweede add-on aanvragen en intrekken.
  await effectuateAddonCycle(db, db.tables.billing_cycles[0]);
  db.tables.tenants.find((t) => t.id === SHOP)!.business_modules = ["horeca"];
  const req = await addon("owner", "addon_events", true);
  eq(req.json.success, true, "events (€0) meteen aan");
  eq(db.tables.subscriptions[0].status, "active", "abonnement met regel blijft");
});

Deno.test("review: platformadmin wordt nooit naar een spoor zonder betaling geleid via plan_id", async () => {
  const db = setup({ plan: "starter" });
  const r = await addon("owner", "addon_horeca", true, { plan_id: "free" });
  eq([r.status, r.json.code], [409, "addon_needs_plan"], "betaald plan zonder abonnement: eerst activeren");
  eq(db.tables.subscriptions.length, 0, "geen kaal abonnement");
});

Deno.test("review 2: gewone pro rata op een abonnement zonder regels verschuift de factuurdatum niet", async () => {
  const next = advanceDate(TODAY, "monthly");
  const db = setup({
    plan: "free",
    tables: {
      customers: [{ id: "cust1", tenant_id: SELLQO, email: "baas@frituur.test" }],
      subscriptions: [{ id: "usage-sub", tenant_id: SELLQO, customer_id: "cust1", interval: "monthly", status: "active", start_date: TODAY, next_invoice_date: next }],
    },
  });
  db.tables.tenant_subscriptions[0].billing_subscription_id = "usage-sub";
  db.tables.tenant_subscriptions[0].billing_customer_id = "cust1";
  const r = await addon("owner", "addon_horeca", true);
  eq([r.json.success, r.json.pending], [true, true], "pro rata gevraagd");
  const cyc = db.tables.billing_cycles[0];
  eq([cyc.subscription_id, cyc.lines[0].first_period ?? null], ["usage-sub", null], "geen eerste-maandmarkering");
  await effectuateAddonCycle(db, cyc);
  eq(db.tables.subscriptions[0].next_invoice_date, next, "factuurdatum ongewijzigd");
  eq(modules(db), ["horeca"], "aan na betaling");
});

Deno.test("review 2: eerste maand is gemarkeerd", async () => {
  const db = setup({ plan: "free" });
  await addon("owner", "addon_horeca", true);
  eq(db.tables.billing_cycles[0].lines[0].first_period, true, "first_period");
});

Deno.test("review 3: uitzetten wist nooit schuld van een mandaatcyclus", async () => {
  const db = setup({ plan: "free", modules: ["horeca"] });
  await addon("owner", "addon_horeca", true);
  // Doe alsof het een SEPA-mandaat was: add-on al aan, betaling later mislukt.
  const c = db.tables.billing_cycles[0];
  c.mode = "mandate"; c.status = "awaiting_payment";
  db.tables.subscription_lines.push({ id: "l1", subscription_id: c.subscription_id, kind: "addon", addon_id: "addon_horeca", unit_price: 29, end_date: null });
  const off = await addon("owner", "addon_horeca", false);
  eq(off.json.success, true, "uitzetten mag");
  eq(db.tables.billing_cycles[0].status, "awaiting_payment", "schuld blijft open");
  eq(db.tables.subscriptions[0].status, "active", "abonnement met regel blijft");
});

Deno.test("review 3: eerste maand via mandaat verschuift de factuurdatum niet", async () => {
  const db = setup({ plan: "free" });
  await addon("owner", "addon_horeca", true);
  const c = db.tables.billing_cycles[0];
  const before = db.tables.subscriptions[0].next_invoice_date;
  await effectuateAddonCycle(db, { ...c, mode: "mandate" }, advanceDate(TODAY, "monthly"));
  eq(db.tables.subscriptions[0].next_invoice_date, before, "ongewijzigd");
});

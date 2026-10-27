/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// BILLING-LOCK-2 / PAYMENT-ALERT-1 — webshop dicht enkel bij opschorting of eigen offline-
// stand, fail-open; na betaling meteen weer actief én gemeld, aan winkel en SellQo, één keer.
//
// Run: deno test --allow-env --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/billingLock.test.ts
import { cachedShopStatus, clearShopStatusCache, resolveShopStatus } from "../../supabase/functions/_shared/shopStatus.ts";
import {
  announceBlockToSellqo,
  announceReopen,
  announceReopenToSellqo,
  refreshStateForCustomer,
} from "../../supabase/functions/_shared/billingReopen.ts";
import { StatefulDb, type Row } from "./statefulDb.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

const SHOP = "11111111-1111-1111-1111-111111111111";
const SELLQO = "99999999-9999-9999-9999-999999999999";
const CUSTOMER = "22222222-2222-2222-2222-222222222222";

function db(over: { tenant?: Row; theme?: Row | null; sub?: Row; cycles?: Row[] } = {}): StatefulDb {
  return new StatefulDb({
    tenants: [
      { id: SHOP, name: "Astra Sleep", slug: "astra-sleep", is_demo: false, is_internal_tenant: false, billing_exempt: false, billing_on_hold: false, ...(over.tenant ?? {}) },
      { id: SELLQO, name: "SellQo", slug: "sellqo", is_demo: false, is_internal_tenant: true, billing_exempt: false, billing_on_hold: false },
    ],
    tenant_theme_settings: over.theme === null ? [] : [{ tenant_id: SHOP, storefront_status: "online", ...(over.theme ?? {}) }],
    tenant_subscriptions: [{ tenant_id: SHOP, status: "suspended", trial_end: null, plan_id: "starter", billing_customer_id: CUSTOMER, ...(over.sub ?? {}) }],
    billing_cycles: over.cycles ?? [],
    invoices: [],
    notifications: [],
  });
}

const fixed = (state: string) => () => Promise.resolve(state);

// ---------- shopStatus ----------

Deno.test("open bij actief", async () => {
  eq(await resolveShopStatus(db() as any, SHOP, fixed("active")), { open: true, reason: "open" }, "actief");
});

Deno.test("leesmodus en achterstallig houden de webshop open", async () => {
  eq((await resolveShopStatus(db() as any, SHOP, fixed("restricted"))).open, true, "restricted");
  eq((await resolveShopStatus(db() as any, SHOP, fixed("past_due"))).open, true, "past_due");
});

Deno.test("dicht bij opgeschort", async () => {
  eq(await resolveShopStatus(db() as any, SHOP, fixed("suspended")), { open: false, reason: "suspended" }, "suspended");
});

Deno.test("dicht als de winkel zichzelf offline zette, ook als vrijgesteld", async () => {
  eq((await resolveShopStatus(db({ theme: { storefront_status: "offline" }, tenant: { billing_exempt: true } }) as any, SHOP, fixed("active"))).reason, "maintenance", "offline");
});

Deno.test("'password' en ontbrekende thema-rij sluiten niet", async () => {
  eq((await resolveShopStatus(db({ theme: { storefront_status: "password" } }) as any, SHOP, fixed("active"))).open, true, "password");
  eq((await resolveShopStatus(db({ theme: null }) as any, SHOP, fixed("active"))).open, true, "geen thema");
});

Deno.test("demo, intern, vrijgesteld en on hold nooit dicht door facturatie", async () => {
  for (const flag of ["is_demo", "is_internal_tenant", "billing_exempt", "billing_on_hold"]) {
    eq((await resolveShopStatus(db({ tenant: { [flag]: true } }) as any, SHOP, fixed("suspended"))).open, true, flag);
  }
});

Deno.test("fail-open bij een fout, en fouten worden niet gecachet", async () => {
  const boom = () => Promise.reject(new Error("db weg"));
  eq(await resolveShopStatus(db() as any, SHOP, boom), { open: true, reason: "error" }, "fout");
  const broken = { from: () => { throw new Error("kapot"); } };
  clearShopStatusCache();
  eq((await cachedShopStatus(broken as any, SHOP, 1000)).reason, "error", "eerste");
  // Werkt de databank weer, dan geldt meteen de echte status (geen gecachete fout).
  const d = db({ theme: { storefront_status: "offline" } });
  eq((await cachedShopStatus(d as any, SHOP, 2000)).reason, "maintenance", "na herstel");
  // Binnen 30 s uit de cache, ook als de databank intussen wijzigt.
  d.tables.tenant_theme_settings[0].storefront_status = "online";
  eq((await cachedShopStatus(d as any, SHOP, 20_000)).reason, "maintenance", "cache");
  eq((await cachedShopStatus(d as any, SHOP, 40_000)).reason, "open", "cache verlopen");
  clearShopStatusCache();
});

Deno.test("enkel dicht als de opgeslagen toestand ook opgeschort is", async () => {
  // Live al over de grens, maar de cron (die meldt) heeft nog niet opgeschort: open.
  eq((await resolveShopStatus(db({ sub: { status: "restricted" } }) as any, SHOP, fixed("suspended"))).open, true, "nog niet gemeld");
  // Opgezegd abonnement met een oude open cyclus: nooit dicht door de machine.
  eq((await resolveShopStatus(db({ sub: { status: "canceled" } }) as any, SHOP, fixed("suspended"))).open, true, "canceled");
  // Opgeschort opgeslagen, maar intussen betaald (webhook nog niet doorgekomen): open.
  eq((await resolveShopStatus(db() as any, SHOP, fixed("active"))).open, true, "betaald");
});

Deno.test("echte loadBillingState: opgeschort zonder open posten is weer open", async () => {
  // Geen open cycli of facturen: de echte toestandsberekening geeft geen 'suspended'.
  eq((await resolveShopStatus(db() as any, SHOP)).open, true, "geen schuld");
});

// ---------- billingReopen ----------

Deno.test("na betaling: opgeschort → actief, gemeld aan winkel (hoog) en SellQo, één keer", async () => {
  const d = db();
  const change = await refreshStateForCustomer(d as any, CUSTOMER);
  eq(change, { tenantId: SHOP, tenantName: "Astra Sleep", from: "suspended", to: "active" }, "wissel");
  eq(d.tables.tenant_subscriptions[0].status, "active", "status geschreven");
  await announceReopen(d as any, change);
  const n = d.tables.notifications;
  eq(n.length, 2, "twee meldingen");
  const shop = n.find((x) => x.tenant_id === SHOP)!;
  const sq = n.find((x) => x.tenant_id === SELLQO)!;
  eq([shop.type, shop.priority, shop.category], ["subscription_reactivated", "high", "subscriptions"], "winkelmelding");
  eq(shop.message.includes("webshop inbegrepen"), true, "winkel hoort dat de webshop werkt");
  eq(typeof shop.action_url === "string" && shop.action_url.length > 0, true, "met link");
  eq([sq.type, sq.title], ["subscription_reactivated", "Winkel heropend: Astra Sleep"], "SellQo-melding");
  // Een tweede webhooklevering: geen nieuwe wissel, geen nieuwe melding.
  await announceReopen(d as any, await refreshStateForCustomer(d as any, CUSTOMER));
  eq(d.tables.notifications.length, 2, "geen dubbel");
  // Zelfs dezelfde wissel opnieuw melden binnen het uur: gededupliceerd.
  await announceReopen(d as any, change);
  eq(d.tables.notifications.length, 2, "dedupe");
});

Deno.test("geen melding als er niets wijzigt of de status niet beheerd wordt", async () => {
  const d = db({ sub: { status: "active" } });
  eq(await refreshStateForCustomer(d as any, CUSTOMER), null, "al actief");
  const c = db({ sub: { status: "canceled" } });
  eq(await refreshStateForCustomer(c as any, CUSTOMER), null, "canceled");
  eq(c.tables.tenant_subscriptions[0].status, "canceled", "canceled ongemoeid");
  eq(await refreshStateForCustomer(d as any, null), null, "geen klant");
  await announceReopen(d as any, null);
  await announceReopen(d as any, { tenantId: SHOP, tenantName: "x", from: "trialing", to: "active" });
  eq(d.tables.notifications.length, 0, "proef → actief is geen heropening");
});

Deno.test("cron: blokkade en heropening naar SellQo, nooit naar zichzelf", async () => {
  const d = db();
  await announceBlockToSellqo(d as any, { tenantId: SHOP, tenantName: "Astra Sleep", from: "restricted", to: "suspended" });
  await announceBlockToSellqo(d as any, { tenantId: SHOP, tenantName: "Astra Sleep", from: "active", to: "past_due" });
  await announceReopenToSellqo(d as any, { tenantId: SHOP, tenantName: "Astra Sleep", from: "restricted", to: "active" }, false);
  const n = d.tables.notifications;
  eq(n.map((x) => [x.tenant_id, x.type, x.priority]), [
    [SELLQO, "subscription_state_changed", "urgent"],
    [SELLQO, "subscription_reactivated", "high"],
  ], "enkel opgeschort + heropening, naar SellQo");
  eq(n[0].title, "Winkel opgeschort: Astra Sleep", "titel");
  eq(n[1].message.startsWith("Betaling ontvangen"), false, "cron zegt niet dat er betaald is");
  // SellQo zelf: geen melding over zichzelf.
  await announceBlockToSellqo(d as any, { tenantId: SELLQO, tenantName: "SellQo", from: "active", to: "suspended" });
  eq(d.tables.notifications.length, 2, "niet over zichzelf");
});

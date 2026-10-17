import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  addonIsBilled, addonPrice, applyCommitmentToCancel, commitmentBlocksSwitch, commitmentEnd, endedAddonLines,
  feeLine, feeLines, invoiceLinesFromSnapshot, linesForPeriod, pendingAppliesAt, planLines, sumFees, tenantIsNotBilled, usageDecision,
} from "./addonBilling.ts";

const plan = { id: "p", kind: "plan", unit_price: 29, quantity: 1, sort_order: 0 };
const oldRow = { id: "o", unit_price: 29, quantity: 1 }; // vóór de migratie: geen kind
const webshop = { id: "a", kind: "addon", addon_id: "addon_webshop", unit_price: 19, quantity: 1, sort_order: 10, end_date: null as string | null };

Deno.test("planregels: alleen plan (oude rij zonder soort telt als plan)", () => {
  assertEquals(planLines([plan, webshop, oldRow]).map((l) => l.id), ["p", "o"]);
});

Deno.test("een gestopte add-on telt niet meer vanaf de volgende periode", () => {
  const ending = { ...webshop, end_date: "2026-10-31" };
  assertEquals(linesForPeriod([plan, ending], "2026-10-15").length, 2, "nog binnen de betaalde periode");
  assertEquals(linesForPeriod([plan, ending], "2026-11-01").map((l) => l.id), ["p"]);
  assertEquals(endedAddonLines([plan, ending], "2026-11-01").map((l) => l.id), ["a"]);
});

Deno.test("add-onprijs volgt het interval; events-add-on wordt nooit gefactureerd", () => {
  const a = { id: "addon_webshop", name: "Webshop-add-on", track: "webshop", monthly_price: 19, yearly_price: 190 };
  assertEquals(addonPrice(a, "monthly"), 19);
  assertEquals(addonPrice(a, "yearly"), 190);
  assertEquals(addonIsBilled({ ...a, id: "addon_events", monthly_price: 0, yearly_price: 0 }), false);
});

Deno.test("vrijgestelde, interne, demo- en on-hold-winkels worden niet gefactureerd", () => {
  assertEquals(tenantIsNotBilled({ billing_exempt: true }), true);
  assertEquals(tenantIsNotBilled({ billing_on_hold: true }), true);
  assertEquals(tenantIsNotBilled({ is_demo: true }), true);
  assertEquals(tenantIsNotBilled({}), false);
});

Deno.test("fees: som en factuurregel", () => {
  const rows = [{ order_id: "1", tickets: 4, fee_cents: 276 }, { order_id: "2", tickets: 1, fee_cents: 69 }];
  assertEquals(sumFees(rows), { cents: 345, tickets: 5 });
  assertEquals(feeLine(rows)?.unit_price, 3.45);
  assertEquals(feeLine([]), null);
});

Deno.test("verbruik zonder abonnement pas vanaf €5, met abonnement altijd mee", () => {
  assertEquals(usageDecision(0, 345), "skip_roll_over");
  assertEquals(usageDecision(0, 500), "include");
  assertEquals(usageDecision(1, 69), "include");
  assertEquals(usageDecision(1, 0), "nothing");
  assertEquals(usageDecision(0, 0), "nothing");
});

Deno.test("factuurregels tellen exact op tot de btw van de cyclus", () => {
  const snap = [
    { description: "Starter", quantity: 1, unit_price: 29, vat_rate: 21 },
    { description: "Horeca-add-on", quantity: 1, unit_price: 29, vat_rate: 21 },
    { description: "Ticketkosten", quantity: 1, unit_price: 3.45, vat_rate: 21 },
  ];
  // cyclus: btw per tarief-groep gesommeerd en dan afgerond = 61,45 * 0,21 = 12,90
  const rows = invoiceLinesFromSnapshot(snap, 12.90);
  assertEquals(+rows.reduce((a, r) => a + r.vat_amount, 0).toFixed(2), 12.90);
  assertEquals(+rows.reduce((a, r) => a + r.net, 0).toFixed(2), 61.45);
});

Deno.test("contracteinde: 12 maanden, ook op het einde van een maand", () => {
  assertEquals(commitmentEnd("2026-10-17", 12), "2027-10-17");
  assertEquals(commitmentEnd("2026-01-31", 1), "2026-02-28");
});

Deno.test("opzeggen binnen het contract loopt tot het contracteinde", () => {
  const d = { accessUntil: "2026-11-17T00:00:00Z", billingEndDate: "2026-11-16" };
  const r = applyCommitmentToCancel(d, "2027-10-17T00:00:00Z");
  assertEquals(r.extendedByCommitment, true);
  assertEquals(r.billingEndDate, "2027-10-16");
  assertEquals(applyCommitmentToCancel(d, null).extendedByCommitment, false);
  assertEquals(applyCommitmentToCancel(d, "2026-11-01T00:00:00Z").extendedByCommitment, false, "contract al voorbij");
});

Deno.test("binnen het contract alleen upgraden binnen hetzelfde spoor", () => {
  const vast = { monthly_price: 49, track: "events" };
  assertEquals(commitmentBlocksSwitch("2027-10-17", "2026-12-01", vast, { monthly_price: 0, track: "events" }), true, "naar Flex: nee");
  assertEquals(commitmentBlocksSwitch("2027-10-17", "2026-12-01", vast, { monthly_price: 79, track: "webshop" }), true, "ander spoor: nee");
  assertEquals(commitmentBlocksSwitch("2027-10-17", "2026-12-01", vast, { monthly_price: 49, track: "events" }), false);
  assertEquals(commitmentBlocksSwitch("2026-11-01", "2026-12-01", vast, { monthly_price: 0, track: "events" }), false, "contract voorbij");
});

Deno.test("runner: opzegging binnen het contract niet op de eerstvolgende maandgrens toepassen", () => {
  assertEquals(pendingAppliesAt("2027-10-17T00:00:00Z", "2026-11-17"), false, "Vast opgezegd in maand 2");
  assertEquals(pendingAppliesAt("2027-10-17T00:00:00Z", "2027-10-17"), true, "op het contracteinde");
  assertEquals(pendingAppliesAt("2026-11-17T00:00:00Z", "2026-11-17"), true, "gewone downgrade op de grens");
  assertEquals(pendingAppliesAt(null, "2026-11-17"), true);
});

Deno.test("LIMITS-1: ticketfees en orderfees elk een eigen factuurregel", () => {
  const rows = [
    { order_id: "t1", tickets: 3, fee_cents: 207, source: "ticket" as const },
    { order_id: "o1", tickets: 1, fee_cents: 100, source: "order" as const },
    { order_id: "o2", tickets: 1, fee_cents: 150, source: "order" as const },
  ];
  const lines = feeLines(rows);
  assertEquals(lines.map((l) => [l.description, l.unit_price]), [
    ["Ticketkosten verkoop buiten de webshop (3 tickets)", 2.07],
    ["Transactiekosten boven je gratis orders (2 orders)", 2.5],
  ]);
  assertEquals(feeLines([{ order_id: "o1", tickets: 1, fee_cents: 100, source: "order" }]).length, 1);
  assertEquals(feeLines([]).length, 0);
});

// AI-AGENT-2 — deno test --no-lock supabase/functions/_shared/aiInsights.test.ts
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { brusselsMidnightUtc, discountFactors, parseRange, profitEstimate, resolveOrderChannel, salesSummary, topProducts } from "./aiInsights.ts";

Deno.test("Brussel: middernacht in winter- en zomertijd", () => {
  assertEquals(brusselsMidnightUtc("2026-01-15").toISOString(), "2026-01-14T23:00:00.000Z");
  assertEquals(brusselsMidnightUtc("2026-07-15").toISOString(), "2026-07-14T22:00:00.000Z");
  assertEquals(brusselsMidnightUtc("2026-10-25").toISOString(), "2026-10-24T22:00:00.000Z"); // dag van de omschakeling
});

Deno.test("parseRange (25-10 middernacht is nog zomertijd)", () => {
  const w = parseRange("2026-10-26", "2026-10-26");
  assertEquals(w.ok && [w.startIso, w.endIso], ["2026-10-25T23:00:00.000Z", "2026-10-26T23:00:00.000Z"]);
  const r = parseRange("2026-10-24", "2026-10-24");
  assertEquals(r.ok && [r.startIso, r.endIso, r.days], ["2026-10-23T22:00:00.000Z", "2026-10-24T22:00:00.000Z", 1]);
  assertEquals(parseRange("2026-10-24", "2026-10-01"), { ok: false, error: "invalid_range" });
  assertEquals(parseRange("gisteren", null), { ok: false, error: "invalid_date" });
});

Deno.test("kanaalregel = salesStats.resolveOrderChannel", () => {
  assertEquals(resolveOrderChannel({ marketplace_source: "bol_com", sales_channel: "webshop" }), "bol_com");
  assertEquals(resolveOrderChannel({ marketplace_source: "shopify_draft_order" }), "webshop");
  assertEquals(resolveOrderChannel({ marketplace_source: "web", sales_channel: "qr" }), "qr");
  assertEquals(resolveOrderChannel({}), "webshop");
});

Deno.test("omzet = betaald en niet geannuleerd + kassatickets zonder order", () => {
  const s = salesSummary(
    [
      { id: "a", created_at: "2026-10-24T10:00:00Z", total: 100, status: "delivered", payment_status: "paid" },
      { id: "b", created_at: "2026-10-24T11:00:00Z", total: 50, status: "cancelled", payment_status: "paid" },
      { id: "c", created_at: "2026-10-24T12:00:00Z", total: 70, status: "pending", payment_status: "pending" },
    ],
    [
      { created_at: "2026-10-24T13:00:00Z", total: 20, status: "completed", order_id: null },
      { created_at: "2026-10-24T14:00:00Z", total: 99, status: "completed", order_id: "a" },
    ],
    { from: "2026-10-24", to: "2026-10-24", days: 1 },
  );
  assertEquals([s.revenue_incl_vat, s.sales_count, s.average_ticket], [120, 2, 60]);
  assertEquals(s.by_channel.map((c) => c.channel), ["webshop", "pos"]);
});

Deno.test("winstschatting: enkel regels met kostprijs, excl. btw", () => {
  const items = [
    { order_id: "a", product_id: "p1", product_name: "Pizza", quantity: 2, total_price: 24.2, vat_amount: 4.2 },
    { order_id: "a", product_id: "p2", product_name: "Cola", quantity: 1, total_price: 3, vat_amount: 0.5 },
    { order_id: "x", product_id: "p1", product_name: "Pizza", quantity: 9, total_price: 100, vat_amount: 10 },
  ];
  const p = profitEstimate(items, new Set(["a"]), new Map([["p1", 4]]));
  assertEquals([p.revenue_excl_vat_with_cost, p.cost_of_goods, p.gross_profit_estimate, p.margin_pct], [20, 8, 12, 60]);
  assertEquals(p.products_without_cost_price, ["Cola"]);
  assertEquals(p.coverage_pct, 88.9);
  assertEquals(topProducts(items, new Set(["a"]), "quantity", 5)[0].name, "Pizza");
});

Deno.test("winst: bewaarde kostprijs gaat vóór de huidige", () => {
  const items = [{ order_id: "a", product_id: "p1", product_name: "Pizza", quantity: 1, total_price: 12.1, vat_amount: 2.1, cost_price: 3 }];
  const p = profitEstimate(items, new Set(["a"]), new Map([["p1", 5]]));
  assertEquals([p.cost_of_goods, p.gross_profit_estimate, p.exact_cost_lines_pct], [3, 7, 100]);
});

Deno.test("korting op orderniveau wordt over de regels verdeeld", () => {
  const items = [{ order_id: "a", product_id: "p1", product_name: "Ticket", quantity: 1, total_price: 100, vat_amount: 0 }];
  const f = discountFactors([{ id: "a", created_at: "", total: 75, discount_amount: 25, status: "paid", payment_status: "paid" }], items);
  const p = profitEstimate(items, new Set(["a"]), new Map([["p1", 10]]), f);
  assertEquals([p.revenue_excl_vat_with_cost, p.gross_profit_estimate], [75, 65]);
  assertEquals(topProducts(items, new Set(["a"]), "revenue", 1, f)[0].revenue, 75);
});

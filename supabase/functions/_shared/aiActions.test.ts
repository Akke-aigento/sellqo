import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { buildProposal, planAllowsActions, revalidate, type ProductSnapshot } from "./aiActions.ts";

const now = new Date("2026-10-30T20:00:00Z");
const tee: ProductSnapshot = { id: "p1", name: "T-shirt", price: 25, stock: 4, track_inventory: true, sold_out_until: null, variants: [] };
const pizza: ProductSnapshot = { ...tee, id: "p2", name: "Margherita", price: 12, stock: null, track_inventory: false };
const hoodie: ProductSnapshot = { ...tee, id: "p3", name: "Hoodie", variants: [{ id: "v1", name: "M", stock: 2, track_inventory: true }] };

Deno.test("stock bijtellen en vastzetten", () => {
  const add = buildProposal("propose_stock_change", { mode: "add", amount: 10 }, tee, now);
  assertEquals(add.ok && add.value, { kind: "stock", product_id: "p1", variant_id: null, product_name: "T-shirt", before: 4, after: 14, delta: 10, mode: "add", amount: 10 });
  const set = buildProposal("propose_stock_change", { mode: "set", amount: 0 }, tee, now);
  assertEquals(set.ok && set.value.delta, -4);
  const neg = buildProposal("propose_stock_change", { mode: "add", amount: -10 }, tee, now);
  assertEquals(neg.ok && neg.value.after, 0);
});

Deno.test("stock: varianten verplicht, niet-opgevolgde voorraad geweigerd", () => {
  assertEquals(buildProposal("propose_stock_change", { mode: "add", amount: 1 }, hoodie, now), { ok: false, error: "variant_required" });
  const v = buildProposal("propose_stock_change", { mode: "add", amount: 1, variant_id: "v1" }, hoodie, now);
  assertEquals(v.ok && v.value.product_name, "Hoodie — M");
  assertEquals(buildProposal("propose_stock_change", { mode: "add", amount: 1 }, pizza, now), { ok: false, error: "stock_not_tracked" });
  assertEquals(buildProposal("propose_stock_change", { mode: "add", amount: 1.5 }, tee, now), { ok: false, error: "invalid_amount" });
});

Deno.test("prijs en uitverkocht", () => {
  const p = buildProposal("propose_price_change", { new_price: 27.499 }, tee, now);
  assertEquals(p.ok && p.value.after, 27.5);
  assertEquals(buildProposal("propose_price_change", { new_price: -1 }, tee, now), { ok: false, error: "invalid_price" });
  assertEquals(buildProposal("propose_price_change", { new_price: 25 }, tee, now), { ok: false, error: "no_change" });
  const so = buildProposal("propose_sold_out", { sold_out: true }, pizza, now);
  assertEquals(so.ok && so.value.before, false);
  assertEquals(buildProposal("propose_sold_out", { sold_out: false }, pizza, now), { ok: false, error: "no_change" });
  assertEquals(buildProposal("propose_price_change", { new_price: 5 }, null, now), { ok: false, error: "product_not_found" });
});

Deno.test("revalidate: 'zet op 14' blijft 14, '+10' blijft +10 na een verkoop", () => {
  const sold = { ...tee, stock: 3 };
  const set = revalidate({ kind: "stock", product_id: "p1", variant_id: null, after: 14, delta: 10, mode: "set" }, sold, now);
  assertEquals(set.ok && [set.value.after, set.value.delta], [14, 11]);
  const add = revalidate({ kind: "stock", product_id: "p1", variant_id: null, after: 14, delta: 10, mode: "add" }, sold, now);
  assertEquals(add.ok && [add.value.after, add.value.delta], [13, 10]);
});

Deno.test("planAllowsActions", () => {
  assertEquals(planAllowsActions({ ai_actions: true }), true);
  assertEquals(planAllowsActions({ ai_actions: "true" }), false);
  assertEquals(planAllowsActions(null), false);
});

Deno.test("ontbrekende waarden worden nooit 0", () => {
  assertEquals(buildProposal("propose_stock_change", { mode: "set", amount: null }, tee, now), { ok: false, error: "invalid_amount" });
  assertEquals(buildProposal("propose_price_change", { new_price: null }, tee, now), { ok: false, error: "invalid_price" });
  assertEquals(revalidate({ kind: "price", product_id: "p1", variant_id: null, after: null }, tee, now), { ok: false, error: "invalid_price" });
});

Deno.test("add na klemmen: -10 op 3 en later voorraad 10 geeft 0", () => {
  const prop = buildProposal("propose_stock_change", { mode: "add", amount: -10 }, { ...tee, stock: 3 }, now);
  assertEquals(prop.ok && prop.value.delta, -3);
  const later = revalidate({ ...(prop.ok ? prop.value : {}), kind: "stock", product_id: "p1", variant_id: null, after: 0 } as never, { ...tee, stock: 10 }, now);
  assertEquals(later.ok && later.value.after, 0);
});

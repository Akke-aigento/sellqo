// MAIL-2a — pure logica van de automations.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  buildCartItemsHtml,
  firstNameOf,
  htmlSafeVars,
  mapEnqueueError,
  mergeAutomationVars,
  pickReviewUrl,
  retryDelayMinutes,
  shortLocale,
  stepDueAt,
} from "./automationVars.ts";

Deno.test("gewone campagne: zonder variabelen exact dezelfde map", () => {
  const base = { customer_first_name: "Jan", company_name: "Shop" };
  assertEquals(mergeAutomationVars(base, null), base);
  assertEquals(mergeAutomationVars(base, undefined), base);
});

Deno.test("automation: vijf variabelen altijd gevuld, interne sleutels nooit", () => {
  const out = mergeAutomationVars({ customer_first_name: "", customer_name: "Klant" }, {
    order_number: "#1001",
    shop_url: "https://shop.be",
    _consent: "soft_optin",
    customer_first_name: "Els",
  });
  assertEquals(out.order_number, "#1001");
  assertEquals(out.shop_url, "https://shop.be");
  assertEquals(out.review_url, "");
  assertEquals(out.cart_url, "");
  assertEquals(out.cart_items, "");
  assertEquals(out.customer_first_name, "Els");
  assertEquals(out.customer_name, "Els");
  assertFalse("_consent" in out);
});

Deno.test("voornaam van de klantrij wint van die uit de bestelling", () => {
  const out = mergeAutomationVars({ customer_first_name: "Jan" }, { customer_first_name: "Piet" });
  assertEquals(out.customer_first_name, "Jan");
});

Deno.test("HTML: alles ge-escaped behalve de opgebouwde productlijst", () => {
  const vars = htmlSafeVars({ order_number: "<b>1</b>", cart_items: "<ul><li>1 × A</li></ul>" });
  assertEquals(vars.order_number, "&lt;b&gt;1&lt;/b&gt;");
  assertEquals(vars.cart_items, "<ul><li>1 × A</li></ul>");
  // Alles wat niet exact de vorm van buildCartItemsHtml heeft, wordt ge-escaped.
  assertEquals(htmlSafeVars({ cart_items: "<img src=x onerror=alert(1)>" }).cart_items, "&lt;img src=x onerror=alert(1)&gt;");
  assertEquals(htmlSafeVars({ cart_items: "<ul><li><b>x</b></li></ul>" }).cart_items.startsWith("&lt;ul&gt;"), true);
  const built = buildCartItemsHtml([{ quantity: 1, product_name: "<svg onload=x>" }]);
  assertEquals(htmlSafeVars({ cart_items: built }).cart_items, built);
});

Deno.test("productlijst: namen ge-escaped, max 10, leeg zonder namen", () => {
  const html = buildCartItemsHtml([
    { quantity: 2, product_name: "<script>x</script>", variant_title: "Rood & groot" },
    { quantity: 0, product_name: "Sok" },
    { quantity: 1, product_name: null },
  ]);
  assertEquals(html, "<ul><li>2 × &lt;script&gt;x&lt;/script&gt; (Rood &amp; groot)</li><li>1 × Sok</li></ul>");
  assertEquals(buildCartItemsHtml([]), "");
  const many = buildCartItemsHtml(Array.from({ length: 15 }, (_, i) => ({ quantity: 1, product_name: `P${i}` })));
  assertEquals(many.split("<li>").length - 1, 10);
});

Deno.test("reviewlink: Google eerst, enkel https, uitgeschakeld telt niet", () => {
  assertEquals(pickReviewUrl([
    { platform: "trustpilot", is_enabled: true, external_url: "https://trustpilot.com/review/x" },
    { platform: "google", is_enabled: true, external_url: "https://g.page/r/abc/review" },
  ]), "https://g.page/r/abc/review");
  assertEquals(pickReviewUrl([
    { platform: "google", is_enabled: false, external_url: "https://g.page/r/abc/review" },
    { platform: "trustpilot", is_enabled: true, external_url: "https://trustpilot.com/review/x" },
  ]), "https://trustpilot.com/review/x");
  assertEquals(pickReviewUrl([{ platform: "google", is_enabled: true, external_url: "javascript:alert(1)" }]), null);
  assertEquals(pickReviewUrl([{ platform: "kiyoh", is_enabled: true, external_url: "https://kiyoh.com/x" }]), null);
  assertEquals(pickReviewUrl(null), null);
});

Deno.test("taalkeuze", () => {
  assertEquals(shortLocale("fr-BE"), "fr");
  assertEquals(shortLocale("DE"), "de");
  assertEquals(shortLocale("uk"), null);
  assertEquals(shortLocale(null), null);
  assertEquals(firstNameOf("  Jan  Peeters "), "Jan");
  assertEquals(firstNameOf(null), "");
});

Deno.test("fouten van enqueue_automation_send", () => {
  assertEquals(mapEnqueueError("MAIL_PLAN_LIMIT:500:500"), { kind: "plan_limit", limit: 500, used: 500 });
  assertEquals(mapEnqueueError("MAIL_UNSUBSCRIBED").kind, "cancelled");
  assertEquals(mapEnqueueError("MAIL_NO_CONSENT").kind, "cancelled");
  assertEquals(mapEnqueueError("MAIL_RUN_STATE").kind, "stale");
  assertEquals(mapEnqueueError("connection reset").kind, "error");
});

Deno.test("stapplanning: vertraging vanaf de trigger, nooit in het verleden", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  const paid = new Date("2026-10-20T09:00:00Z");
  assertEquals(stepDueAt(paid, 24, 0, now).toISOString(), "2026-10-21T09:00:00.000Z");
  assertEquals(stepDueAt(paid, 336, 0, now).toISOString(), "2026-11-03T09:00:00.000Z");
  assertEquals(stepDueAt(paid, 0, 0, now).toISOString(), now.toISOString());
  assertEquals(retryDelayMinutes(1), 5);
  assertEquals(retryDelayMinutes(4), 40);
  assertEquals(retryDelayMinutes(9), 40);
});

Deno.test("reviewstap herkennen", async () => {
  Deno.env.set("SUPABASE_URL", "https://x.supabase.co");
  const { stepNeedsReviewUrl } = await import("./automationEngine.ts");
  assert(stepNeedsReviewUrl("post_purchase", 2, null));
  assertFalse(stepNeedsReviewUrl("post_purchase", 1, { subject: "Bedankt", html_content: "<p>x</p>" }));
  assert(stepNeedsReviewUrl("win_back", 1, { subject: "x", html_content: '<a href="{{ review_url }}">' }));
  assert(stepNeedsReviewUrl("welcome_series", 2, { translations: { en: { html_content: "{{review_url}}" } } }));
});

Deno.test("MAIL-2c: productnaam als link, enkel https; vorm blijft ruw toegelaten", () => {
  const html = buildCartItemsHtml([
    { quantity: 1, product_name: "Trui & co", product_url: "https://loveke.be/shop/trui" },
    { quantity: 2, product_name: "Sok", product_url: "javascript:alert(1)" },
    { quantity: 1, product_name: "Muts", product_url: 'https://x.be/"onmouseover=1' },
  ]);
  assertEquals(html, '<ul><li>1 × <a href="https://loveke.be/shop/trui">Trui &amp; co</a></li><li>2 × Sok</li><li>1 × Muts</li></ul>');
  assertEquals(htmlSafeVars({ cart_items: html }).cart_items, html);
  // Een link met een ander schema of een extra attribuut is niet de vorm van buildCartItemsHtml.
  assertEquals(htmlSafeVars({ cart_items: '<ul><li><a href="javascript:x">a</a></li></ul>' }).cart_items.startsWith("&lt;ul&gt;"), true);
  assertEquals(htmlSafeVars({ cart_items: '<ul><li><a href="https://x.be" onclick="y">a</a></li></ul>' }).cart_items.startsWith("&lt;ul&gt;"), true);
});

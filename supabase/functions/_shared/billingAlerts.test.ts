// BILLING-SAFE-1 — teksten en redenen van de betaalmeldingen (puur, zonder netwerk).
// Run: deno test --no-lock supabase/functions/_shared/billingAlerts.test.ts
function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}
function assertStringIncludes(text: string, part: string) {
  if (!text.includes(part)) throw new Error(`"${part}" ontbreekt in "${text}"`);
}
import { chargeFailedText, chargeUnclearText, declineReason, isPaymentDecline, euro, joinNumbers, paymentReceivedText, unprocessedPaymentText } from "./billingAlerts.ts";

Deno.test("euro: twee decimalen met komma", () => {
  assertEquals(euro(35.09), "€35,09");
  assertEquals(euro(95.585), "€95,59");
  assertEquals(euro(0), "€0,00");
});

Deno.test("joinNumbers: lege waarden vallen weg, laatste met 'en'", () => {
  assertEquals(joinNumbers([]), "");
  assertEquals(joinNumbers(["PR-1"]), "PR-1");
  assertEquals(joinNumbers(["PR-1", null, "SQ-1", " "]), "PR-1 en SQ-1");
  assertEquals(joinNumbers(["A", "B", "C"]), "A, B en C");
});

Deno.test("paymentReceivedText: bundel met nieuwe factuur en mail", () => {
  const t = paymentReceivedText({
    customerName: "Astra Sleep",
    amount: 95.59,
    paidFor: ["PR-2026-0004", "SQ-2026-0001"],
    newInvoiceNumbers: ["INV-2026-0162"],
    mailed: true,
    subscriptionStatus: "active",
  });
  assertEquals(t.title, "Betaling ontvangen: €95,59 van Astra Sleep");
  assertStringIncludes(t.message, "betaalde €95,59 voor PR-2026-0004 en SQ-2026-0001.");
  assertStringIncludes(t.message, "Factuur INV-2026-0162 is aangemaakt en gemaild.");
  assertStringIncludes(t.message, "Abonnement van de klant: actief.");
});

Deno.test("paymentReceivedText: mislukte mail wordt gezegd", () => {
  const t = paymentReceivedText({ customerName: "X", amount: 10, paidFor: [], newInvoiceNumbers: ["INV-1"], mailed: false });
  assertStringIncludes(t.message, "mail naar de klant mislukte");
  assertEquals(t.message.includes(" voor "), false);
});

Deno.test("chargeFailedText: met en zonder betaalverzoek", () => {
  const ok = chargeFailedText({ customerName: "Astra", amount: 35.09, prNumber: "PR-2026-0007", reason: "onvoldoende saldo", graceUntil: "2026-11-03", requestSent: true });
  assertEquals(ok.title, "Afschrijving mislukt: Astra");
  assertStringIncludes(ok.message, "€35,09 (PR-2026-0007) bij Astra is mislukt: onvoldoende saldo.");
  assertStringIncludes(ok.message, "kreeg meteen een betaalverzoek");
  assertStringIncludes(ok.message, "na 03/11/2026 in leesmodus");
  const ko = chargeFailedText({ customerName: "Astra", amount: 1, prNumber: null, reason: null, graceUntil: null, requestSent: false });
  assertStringIncludes(ko.message, "kon niet automatisch verstuurd worden");
  assertEquals(ko.message.includes("leesmodus"), false);
});

Deno.test("unprocessedPaymentText noemt de Stripe-id", () => {
  const t = unprocessedPaymentText({ customerName: "A", amount: 5, intentId: "pi_1", step: "factuur aanmaken: x" });
  assertStringIncludes(t.message, "pi_1");
  assertStringIncludes(t.message, "factuur aanmaken: x");
});

Deno.test("declineReason: decline_code eerst, dan code, dan boodschap", () => {
  assertEquals(declineReason("card_declined", "insufficient_funds", "x"), "onvoldoende saldo");
  assertEquals(declineReason("expired_card", null, null), "kaart vervallen");
  assertEquals(declineReason("weird", null, "Something odd"), "Something odd");
  assertEquals(declineReason(null, null, null), null);
  assertEquals(declineReason(null, null, "x".repeat(200))!.length, 120);
});

Deno.test("isPaymentDecline: enkel een echte weigering", () => {
  assertEquals(isPaymentDecline({ type: "StripeCardError", code: "card_declined" }), true);
  assertEquals(isPaymentDecline({ type: "StripeInvalidRequestError", raw: { payment_intent: { status: "requires_payment_method" } } }), true);
  assertEquals(isPaymentDecline({ type: "StripeConnectionError" }), false);
  assertEquals(isPaymentDecline({ type: "StripeAPIError", raw: { payment_intent: { status: "succeeded" } } }), false);
  assertEquals(isPaymentDecline(new Error("Tenant not found for cycle charge")), false);
  assertEquals(isPaymentDecline(null), false);
});

Deno.test("chargeUnclearText: geen betaalverzoek, wel Stripe nakijken", () => {
  const t = chargeUnclearText({ customerName: "Astra", amount: 35.09, error: "Request timed out" });
  assertEquals(t.title, "Afschrijving onzeker: Astra");
  assertStringIncludes(t.message, "kijk Stripe na vóór je een betaalverzoek stuurt");
});

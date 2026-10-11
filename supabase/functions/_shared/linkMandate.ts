// BILL-FIX-1 (11-10-2026) — betalen via de betaallink = meteen het mandaat.
//
// Een klant op een mandaat-abonnement zonder mandaat (Astra Sleep) kreeg elke
// maand een betaallink, en betalen via die link bewaarde niets: volgende maand
// opnieuw een link. Nu vraagt de link (alleen voor SellQo-platformfacturatie)
// Stripe om het betaalmiddel te bewaren (setup_future_usage: off_session), en
// zet platform-stripe-webhook het na een geslaagde betaling als mandaat vast.
// Daarna incasseert de abonnementsrun gewoon off-session.
//
// Puur en getest (src/test/linkMandate.test.ts).

export const SAVE_MANDATE_FLAG = "save_mandate";

/** Checkout-parameters aanvullen zodat Stripe het betaalmiddel bewaart. */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withSaveMandate(params: any, stripeCustomerId: string, customerId: string): any {
  // customer en customer_email sluiten elkaar uit in Checkout.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { customer_email: _drop, ...rest } = params ?? {};
  const flag = { [SAVE_MANDATE_FLAG]: "1", mandate_customer_id: customerId };
  return {
    ...rest,
    customer: stripeCustomerId,
    metadata: { ...(rest.metadata ?? {}), ...flag },
    payment_intent_data: {
      ...(rest.payment_intent_data ?? {}),
      setup_future_usage: "off_session",
      metadata: { ...(rest.payment_intent_data?.metadata ?? {}), ...flag },
    },
  };
}

export type ReusableMethod = { paymentMethodId: string; methodType: "card" | "sepa_debit" };

/**
 * Welk betaalmiddel is herbruikbaar voor off-session incasso?
 * Kaart en SEPA: het betaalmiddel zelf. Bancontact/iDEAL/Sofort: Stripe maakt
 * er een SEPA-mandaat van (generated_sepa_debit op de charge). Anders: niets.
 */
export function reusablePaymentMethod(
  pmType: string | null | undefined,
  pmId: string | null | undefined,
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chargeMethodDetails?: any,
): ReusableMethod | null {
  if (!pmType || !pmId) return null;
  if (pmType === "card") return { paymentMethodId: pmId, methodType: "card" };
  if (pmType === "sepa_debit") return { paymentMethodId: pmId, methodType: "sepa_debit" };
  if (pmType === "bancontact" || pmType === "ideal" || pmType === "sofort") {
    const generated = chargeMethodDetails?.[pmType]?.generated_sepa_debit;
    const id = typeof generated === "string" ? generated : generated?.id;
    return id ? { paymentMethodId: id, methodType: "sepa_debit" } : null;
  }
  return null;
}

export function wantsMandateSave(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[SAVE_MANDATE_FLAG] === "1" && typeof metadata?.mandate_customer_id === "string"
    && typeof metadata?.tenant_id === "string";
}

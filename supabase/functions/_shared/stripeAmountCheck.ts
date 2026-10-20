// CART-PRICE-1 — klopt wat Stripe inde met het totaal van de order die we aanmaken?
// Gebruikt door storefront-api (checkout_verify_payment) en stripe-connect-webhook.
// Een verschil houdt de order nooit tegen (het geld is binnen): de order krijgt een interne
// notitie en we loggen het, zodat de winkel het kan nakijken.
//
// Verwacht bedrag = ordertotaal + transactiekosten die aan de klant werden doorgerekend
// (metadata.transaction_fee_cents, sinds CART-PRICE-1 op de sessie; oudere sessies: 0).
// Speling: Stripe krijgt de korting per eenheid afgerond verdeeld, dat kan per regel enkele
// centen schelen. De aanroeper geeft die speling mee (0 zonder korting).

export type StripeSessionLike = {
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
};

export type AmountMismatch = { charged_cents: number; expected_cents: number; diff_cents: number };

export function stripeAmountMismatch(session: StripeSessionLike, orderTotal: number, toleranceCents = 0): AmountMismatch | null {
  if (session.amount_total == null || !Number.isFinite(Number(session.amount_total))) return null;
  const charged = Math.round(Number(session.amount_total));
  const fee = Number(session.metadata?.transaction_fee_cents) > 0 ? Math.round(Number(session.metadata?.transaction_fee_cents)) : 0;
  const expected = Math.round((Number(orderTotal) || 0) * 100) + fee;
  const diff = charged - expected;
  if (Math.abs(diff) <= Math.max(0, toleranceCents)) return null;
  return { charged_cents: charged, expected_cents: expected, diff_cents: diff };
}

/** Speling in centen voor de afronding van een korting die Stripe per eenheid verdeelt. */
export function discountRoundingToleranceCents(discountAmount: number, quantities: number[]): number {
  if (!(Number(discountAmount) > 0)) return 0;
  return Math.max(1, ...quantities.map((q) => Math.ceil((Number(q) || 0) / 2) + 1));
}

const eur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Interne notitie op de order (orders.internal_notes), in het Nederlands zoals de admin. */
export function amountMismatchNote(m: AmountMismatch, existing?: string | null): string {
  const line = `Let op: Stripe inde € ${eur(m.charged_cents)}, het ordertotaal (plus doorgerekende transactiekosten) is € ${eur(m.expected_cents)}. Verschil € ${eur(m.diff_cents)}. Controleer deze bestelling.`;
  return existing ? `${existing}\n${line}` : line;
}

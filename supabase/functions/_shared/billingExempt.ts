// BILLING-EXEMPT-1 — staat een winkel buiten SellQo's eigen facturatie?
//
// Tot 01-10 betekende `is_internal_tenant` vijf dingen tegelijk: Stripe via het
// platformaccount, geen facturatie/afdwinging, geen limieten, niet in de
// statistieken, en "Mijn winkels". Akke zette hem voor haar eigen winkels aan om
// ze niet te factureren — waardoor hun eigen factuurbetalingen via SellQo's
// Stripe-account zouden lopen. Nu gesplitst:
//   is_internal_tenant → SellQo zelf (Stripe-routering, zie stripeRouting.ts)
//   billing_exempt     → niet factureren, geen limieten, niet in de statistieken
// SellQo zelf factureert zichzelf ook niet: beide vlaggen tellen als vrijgesteld.
//
// Puur, zonder imports: gedeeld met src/ en getest door vitest.

export interface BillingExemptSource {
  is_internal_tenant?: boolean | null;
  billing_exempt?: boolean | null;
}

export function isBillingExempt(tenant: BillingExemptSource | null | undefined): boolean {
  return tenant?.is_internal_tenant === true || tenant?.billing_exempt === true;
}

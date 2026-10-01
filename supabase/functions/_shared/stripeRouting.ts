// BILLING-EXEMPT-1 — via welk Stripe-account betaalt een tenant?
//
// UITSLUITEND `is_internal_tenant` stuurt naar het platformaccount. `billing_exempt`
// ("niet factureren") speelt hier bewust geen rol: een vrijgestelde winkel met een
// eigen Stripe Connect-account int haar eigen facturen op dat eigen account.
// Tot 01-10 stond die vrijstelling op `is_internal_tenant`, waardoor de
// factuurbetaallinks, dunning-incasso en klantmachtigingen van Loveke, VanXcel en
// The Fonske Crawl via SellQo's account zouden lopen.
//
// Puur, zonder imports: getStripeContext (stripe.ts) gebruikt dit, vitest test het.

export type StripeRouting =
  | { account: "platform" }
  | { account: "connected"; stripeAccountId: string };

export function resolveStripeRouting(tenant: {
  id: string;
  is_internal_tenant?: boolean | null;
  stripe_account_id?: string | null;
}): StripeRouting {
  if (tenant.is_internal_tenant === true) return { account: "platform" };
  if (!tenant.stripe_account_id) {
    throw new Error(
      `Tenant ${tenant.id} has no stripe_account_id and is not internal — cannot charge`,
    );
  }
  return { account: "connected", stripeAccountId: tenant.stripe_account_id };
}

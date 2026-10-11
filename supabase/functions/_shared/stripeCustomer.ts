// BILL-FIX-1 (11-10-2026) — één Stripe-klant per (tenant, klant).
//
// mintMandateSetupLink en create-platform-mandate-setup hergebruikten alleen de
// Stripe-klant van een BESTAAND mandaat. Zolang een klant nooit tekende, maakte
// elke uitnodiging (dunning, cycle-herinnering, admin-knop) een nieuwe Stripe-
// klant aan: Ozay Group (Astra Sleep) had er 9. Nu, in deze volgorde:
//   1. de Stripe-klant van het mandaat (ook een ingetrokken/mislukt mandaat);
//   2. de Stripe-klant van het meest recente machtigingstoken, als die in
//      Stripe nog bestaat;
//   3. pas dan een nieuwe.
// Ook gebruikt door de betaallink (payCheckout.ts) wanneer die het betaalmiddel
// meteen als mandaat bewaart.

// Structureel type i.p.v. `import type { StripeContext } from "./stripe.ts"`:
// dit bestand wordt ook door een vitest-test (src/test) geïmporteerd, en de
// app-typecheck kan stripe.ts (esm.sh-import, Deno-globals) niet resolven.
// StripeContext uit stripe.ts past hier structureel op.
type StripeContext = {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripe: { customers: { retrieve: (id: string, opts?: any) => Promise<unknown>; create: (params: any, opts?: any) => Promise<{ id: string }> } };
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestOptions?: any;
};

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type StripeCustomerSubject = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
};

export type ResolvedStripeCustomer = {
  stripeCustomerId: string;
  source: "mandate" | "token" | "created";
};

export function stripeDisplayName(c: StripeCustomerSubject): string | undefined {
  return (
    c.company_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    c.email ||
    undefined
  );
}

/** Bestaat deze Stripe-klant nog (niet verwijderd)? Fout = onbekend = nee. */
async function stripeCustomerAlive(ctx: StripeContext, id: string): Promise<boolean> {
  try {
    const c = await ctx.stripe.customers.retrieve(id, ctx.requestOptions);
    return !(c as { deleted?: boolean }).deleted;
  } catch {
    return false;
  }
}

export async function resolveStripeCustomerId(
  supabase: Db,
  ctx: StripeContext,
  opts: {
    tenantId: string;
    customer: StripeCustomerSubject;
    metadata?: Record<string, string>;
  },
): Promise<ResolvedStripeCustomer> {
  const { tenantId, customer } = opts;

  const { data: mandate } = await supabase
    .from("customer_payment_mandates")
    .select("stripe_customer_id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (mandate?.stripe_customer_id) {
    return { stripeCustomerId: String(mandate.stripe_customer_id), source: "mandate" };
  }

  const { data: tokens } = await supabase
    .from("mandate_setup_tokens")
    .select("stripe_customer_id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customer.id)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const fromToken = (tokens ?? [])[0]?.stripe_customer_id as string | undefined;
  if (fromToken && (await stripeCustomerAlive(ctx, fromToken))) {
    return { stripeCustomerId: fromToken, source: "token" };
  }

  const created = await ctx.stripe.customers.create(
    {
      email: customer.email ?? undefined,
      name: stripeDisplayName(customer),
      metadata: { tenant_id: tenantId, customer_id: customer.id, ...(opts.metadata ?? {}) },
    },
    ctx.requestOptions,
  );
  return { stripeCustomerId: created.id, source: "created" };
}

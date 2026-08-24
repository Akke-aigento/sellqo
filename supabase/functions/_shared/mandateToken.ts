// BILL-1: minting a mandate setup link, decoupled from the incoming request.
//
// This used to live inside create-mandate-setup, which built the URL from
// `req.headers.get("origin")`. That works for an admin clicking a button in the
// browser and produces `/betaling/machtiging/<token>` — a relative path — for
// every server-to-server caller. The dunning runner is such a caller, so it
// could not send a working link at all.
//
// The token itself, the Stripe customer reuse and the MANDATE-CTX-1 context are
// unchanged; only the base URL is now resolved instead of assumed.

import type { StripeContext } from "./stripe.ts";

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MANDATE-TOKEN] ${step}${suffix}`);
};

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type MandateTenant = {
  id: string;
  name?: string | null;
};

export type MandateCustomer = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
};

export type MintMandateLinkResult = {
  token: string;
  url: string;
  stripeCustomerId: string;
};

/**
 * Base URL for the customer-facing authorization page.
 *
 * `baseUrl` (the caller's origin) wins so an admin on a preview or custom
 * domain keeps getting exactly the link they get today. PUBLIC_APP_URL is the
 * server-side fallback — the same chain create-invoice-payment-link and
 * create-cycle-payment-link already use.
 */
export function resolveMandateBaseUrl(baseUrl?: string | null): string {
  const candidate = (baseUrl || "").trim();
  const base = candidate || Deno.env.get("PUBLIC_APP_URL") || "https://sellqo.app";
  return base.replace(/\/+$/, "");
}

/**
 * MANDATE-CTX-1: build the customer-facing context (amount, reason, interval)
 * server-side from the subscription so the authorization page never shows a
 * blank "carte blanche" form. Amount math is copied from
 * generate-subscription-invoices (pay_first path) so the shown total is exactly
 * what will be collected.
 */
async function buildSubscriptionContext(
  supabase: any,
  tenant: MandateTenant,
  customerId: string,
  subscriptionId: string,
): Promise<Record<string, unknown> | null> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select(
      "id, tenant_id, customer_id, name, interval, interval_count, subscription_lines(description, quantity, unit_price, vat_rate, sort_order)",
    )
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!sub || sub.tenant_id !== tenant.id || sub.customer_id !== customerId) {
    log("Subscription context skipped (not found or mismatch)", { subscriptionId });
    return null;
  }

  const lines = [...((sub as any).subscription_lines ?? [])].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  );
  let subtotal = 0;
  let vatAmount = 0;
  for (const ln of lines) {
    const net = Number(ln.quantity ?? 1) * Number(ln.unit_price ?? 0);
    subtotal += net;
    vatAmount += +(net * Number(ln.vat_rate ?? 0) / 100).toFixed(2);
  }
  subtotal = +subtotal.toFixed(2);
  vatAmount = +vatAmount.toFixed(2);
  const total = +(subtotal + vatAmount).toFixed(2);

  log("Context built from subscription", { subscriptionId, total });
  return {
    source: "subscription",
    creditor: tenant.name,
    reason: lines[0]?.description || sub.name,
    price: total,
    interval: sub.interval,
    interval_count: sub.interval_count,
  };
}

/**
 * Mints a fresh single-use mandate setup token and returns the absolute URL the
 * customer visits to authorize SEPA Direct Debit or card off-session charging.
 *
 * Always mints a NEW token. Tokens live 7 days and reminder levels are further
 * apart than that, so reusing one would put a nearly-expired link in the next
 * email. Older tokens stay valid until they expire, so a customer digging up an
 * earlier mail still gets in.
 */
export async function mintMandateSetupLink(
  supabase: any,
  ctx: StripeContext,
  opts: {
    tenant: MandateTenant;
    customer: MandateCustomer;
    subscriptionId?: string | null;
    baseUrl?: string | null;
  },
): Promise<MintMandateLinkResult> {
  const { tenant, customer } = opts;

  const context = opts.subscriptionId
    ? await buildSubscriptionContext(supabase, tenant, customer.id, opts.subscriptionId)
    : null;

  // Reuse an existing Stripe customer if we already stored one for a previous
  // (revoked/failed) mandate; otherwise create a fresh one.
  let stripeCustomerId: string | null = null;
  const { data: existingMandate } = await supabase
    .from("customer_payment_mandates")
    .select("stripe_customer_id")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (existingMandate?.stripe_customer_id) {
    stripeCustomerId = existingMandate.stripe_customer_id;
  }

  if (!stripeCustomerId) {
    const displayName =
      customer.company_name ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      customer.email ||
      undefined;
    const stripeCustomer = await ctx.stripe.customers.create(
      {
        email: customer.email ?? undefined,
        name: displayName,
        metadata: { tenant_id: tenant.id, customer_id: customer.id },
      },
      ctx.requestOptions,
    );
    stripeCustomerId = stripeCustomer.id;
    log("Created Stripe customer", { stripeCustomerId, onPlatform: ctx.onPlatformAccount });
  }

  const token = randomToken();
  const { error: tokErr } = await supabase.from("mandate_setup_tokens").insert({
    tenant_id: tenant.id,
    customer_id: customer.id,
    token,
    stripe_customer_id: stripeCustomerId,
    ...(context ? { context } : {}),
  });
  if (tokErr) throw tokErr;

  const url = `${resolveMandateBaseUrl(opts.baseUrl)}/betaling/machtiging/${token}`;
  log("Mandate token created", {
    customerId: customer.id,
    tenant: tenant.id,
    hasContext: !!context,
  });

  return { token, url, stripeCustomerId: stripeCustomerId! };
}

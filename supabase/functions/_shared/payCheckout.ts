// PAY-LINK-1 — de vaste betaallink aan de serverkant: link aanmaken, posten
// laden, en bij een klik een verse Stripe Checkout-sessie maken.
//
// De beslissingen (staat, bundelselectie, branding) staan puur in payLink.ts;
// dit bestand doet alleen database- en Stripe-werk. Het schrijft NOOIT in
// `invoices`: een factuur ontstaat pas na betaling, in subscriptionCharge.ts.

import { getStripeContext } from "./stripe.ts";
import { loadBillingTenant } from "./billingTenant.ts";
import {
  cycleState,
  generatePayToken,
  invoiceState,
  payLinkUrl,
  selectBundleItems,
  type BundleItem,
  type PayState,
} from "./payLink.ts";

// deno-lint-ignore no-explicit-any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type PayLinkTarget =
  | { kind: "cycle"; tenantId: string; customerId: string | null; billingCycleId: string }
  | { kind: "invoice"; tenantId: string; customerId: string | null; invoiceId: string }
  | { kind: "customer"; tenantId: string; customerId: string };

export function publicPayUrl(token: string): string {
  return payLinkUrl(token, Deno.env.get("PUBLIC_APP_URL") || "https://sellqo.app");
}

/** De vaste link voor een post (of voor "Alles betalen" van een klant). Idempotent. */
export async function ensurePaymentLink(supabase: Db, target: PayLinkTarget): Promise<string> {
  const find = async (): Promise<string | null> => {
    let q = supabase.from("payment_links").select("token").eq("kind", target.kind);
    if (target.kind === "cycle") q = q.eq("billing_cycle_id", target.billingCycleId);
    else if (target.kind === "invoice") q = q.eq("invoice_id", target.invoiceId);
    else q = q.eq("tenant_id", target.tenantId).eq("customer_id", target.customerId);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`payment_links lezen: ${error.message}`);
    return (data?.token as string | undefined) ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const row: Record<string, unknown> = {
    token: generatePayToken(),
    kind: target.kind,
    tenant_id: target.tenantId,
    customer_id: target.customerId,
    billing_cycle_id: target.kind === "cycle" ? target.billingCycleId : null,
    invoice_id: target.kind === "invoice" ? target.invoiceId : null,
  };
  const { error } = await supabase.from("payment_links").insert(row);
  if (error) {
    // Gelijktijdig aangemaakt (unieke index per post): de andere wint.
    if ((error as { code?: string }).code === "23505") {
      const raced = await find();
      if (raced) return raced;
    }
    throw new Error(`payment_links schrijven: ${error.message}`);
  }
  return row.token as string;
}

export async function payUrlFor(supabase: Db, target: PayLinkTarget): Promise<string> {
  return publicPayUrl(await ensurePaymentLink(supabase, target));
}

// ── Laden ──────────────────────────────────────────────────────────────

const CYCLE_COLS = "id, tenant_id, customer_id, status, invoice_id, total, payment_request_number, period_start, period_end, description";
const INVOICE_COLS = "id, tenant_id, customer_id, status, total, invoice_number, due_date";

export interface PayLinkRow {
  token: string;
  kind: "cycle" | "invoice" | "customer";
  tenant_id: string;
  customer_id: string | null;
  billing_cycle_id: string | null;
  invoice_id: string | null;
  last_checkout_session_id: string | null;
}

export interface ResolvedLink {
  link: PayLinkRow;
  state: PayState | "nothing_open";
  items: BundleItem[];
  total: number;
  currency: string;
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenant: any;
}

export async function loadLink(supabase: Db, token: string): Promise<PayLinkRow | null> {
  const { data, error } = await supabase
    .from("payment_links")
    .select("token, kind, tenant_id, customer_id, billing_cycle_id, invoice_id, last_checkout_session_id")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`payment_links lezen: ${error.message}`);
  return (data as PayLinkRow | null) ?? null;
}

/** De post(en) achter een link, met hun staat. Schrijft niets. */
export async function resolveLink(supabase: Db, link: PayLinkRow): Promise<ResolvedLink> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, is_demo, is_internal_tenant, stripe_account_id, currency")
    .eq("id", link.tenant_id)
    .maybeSingle();
  const currency = String(tenant?.currency || "eur").toLowerCase();

  if (link.kind === "cycle") {
    const { data: c } = await supabase.from("billing_cycles").select(CYCLE_COLS).eq("id", link.billing_cycle_id).maybeSingle();
    const state = cycleState(c);
    const items: BundleItem[] = c ? [{ type: "cycle", id: c.id, number: c.payment_request_number ?? null, amount: Number(c.total ?? 0) }] : [];
    return { link, state, items, total: items[0]?.amount ?? 0, currency, tenant };
  }
  if (link.kind === "invoice") {
    const { data: i } = await supabase.from("invoices").select(INVOICE_COLS).eq("id", link.invoice_id).maybeSingle();
    const state = invoiceState(i);
    const items: BundleItem[] = i ? [{ type: "invoice", id: i.id, number: i.invoice_number ?? null, amount: Number(i.total ?? 0) }] : [];
    return { link, state, items, total: items[0]?.amount ?? 0, currency, tenant };
  }

  // "Alles betalen": alle open posten van deze klant in deze tenant, nu.
  const [{ data: cycles }, { data: invoices }] = await Promise.all([
    supabase.from("billing_cycles").select(CYCLE_COLS)
      .eq("tenant_id", link.tenant_id).eq("customer_id", link.customer_id)
      .in("status", ["pending", "awaiting_payment", "reopened", "expired"])
      .order("period_start", { ascending: true }),
    supabase.from("invoices").select(INVOICE_COLS)
      .eq("tenant_id", link.tenant_id).eq("customer_id", link.customer_id)
      .in("status", ["unpaid", "sent"])
      .order("due_date", { ascending: true }),
  ]);
  const bundle = selectBundleItems({
    tenantId: link.tenant_id,
    customerId: String(link.customer_id),
    cycles: cycles ?? [],
    invoices: invoices ?? [],
  });
  return {
    link,
    state: bundle.items.length ? "open" : "nothing_open",
    items: bundle.items,
    total: bundle.total,
    currency,
    tenant,
  };
}

/** Is de tenant van deze post SellQo zelf (platformbranding)? */
export async function isBillingTenant(supabase: Db, tenantId: string): Promise<boolean> {
  const { data } = await loadBillingTenant(supabase, "id");
  return !!data && data.id === tenantId;
}

// ── Stripe ─────────────────────────────────────────────────────────────

/** Status van de vorige sessie van deze link, of null. Fouten tellen als "onbekend". */
export async function previousSessionStatus(resolved: ResolvedLink): Promise<string | null> {
  const id = resolved.link.last_checkout_session_id;
  if (!id || !resolved.tenant) return null;
  try {
    const ctx = getStripeContext(resolved.tenant);
    const session = await ctx.stripe.checkout.sessions.retrieve(id, ctx.requestOptions);
    return session.status ?? null;
  } catch (e) {
    console.warn("[payCheckout] vorige sessie niet op te halen:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Een verse sessie voor een open link. De vorige open sessie van dezelfde link
 * wordt eerst geëxpireerd: nooit twee betaalbare tabbladen voor één post.
 * Metadata gelijk aan create-cycle-payment-link / create-invoice-payment-link,
 * zodat de afboeking (subscriptionCharge.ts) dezelfde blijft.
 */
export async function createLinkCheckout(supabase: Db, resolved: ResolvedLink): Promise<string> {
  const { link, tenant, items, total, currency } = resolved;
  if (!tenant) throw new Error("Tenant not found");
  const ctx = getStripeContext(tenant);
  const url = publicPayUrl(link.token);

  if (link.last_checkout_session_id) {
    try {
      const prev = await ctx.stripe.checkout.sessions.retrieve(link.last_checkout_session_id, ctx.requestOptions);
      if (prev.status === "open") await ctx.stripe.checkout.sessions.expire(prev.id, ctx.requestOptions);
    } catch (e) {
      console.warn("[payCheckout] vorige sessie niet geëxpireerd:", e instanceof Error ? e.message : String(e));
    }
  }

  let customerEmail: string | undefined;
  if (link.customer_id) {
    const { data: cust } = await supabase.from("customers").select("email").eq("id", link.customer_id).maybeSingle();
    customerEmail = cust?.email || undefined;
  }

  const common = {
    mode: "payment" as const,
    customer_email: customerEmail,
    success_url: `${url}?betaald=1`,
    cancel_url: url,
  };

  // deno-lint-ignore no-explicit-any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let params: any;
  if (link.kind === "cycle") {
    const item = items[0];
    const pr = item.number ?? item.id;
    params = {
      ...common,
      line_items: [{ price_data: { currency, product_data: { name: `Betalingsverzoek ${pr}` }, unit_amount: Math.round(item.amount * 100) }, quantity: 1 }],
      metadata: { billing_cycle_id: item.id, tenant_id: link.tenant_id, payment_request_number: pr, payment_link_token: link.token },
      payment_intent_data: { metadata: { billing_cycle_id: item.id, tenant_id: link.tenant_id } },
    };
  } else if (link.kind === "invoice") {
    const item = items[0];
    params = {
      ...common,
      // Zelfde betaalmethoden als create-invoice-payment-link.
      payment_method_types: ["card", "ideal", "bancontact", "sepa_debit"],
      line_items: [{ price_data: { currency, product_data: { name: `Factuur ${item.number ?? ""}`.trim() }, unit_amount: Math.round(item.amount * 100) }, quantity: 1 }],
      metadata: { invoice_id: item.id, tenant_id: link.tenant_id, invoice_number: item.number ?? "", payment_link_token: link.token },
      payment_intent_data: { metadata: { invoice_id: item.id, tenant_id: link.tenant_id } },
    };
  } else {
    // Bundel: snapshot vastleggen, oude open bundels van deze link vervallen.
    await supabase.from("payment_bundles").update({ status: "superseded" }).eq("token", link.token).eq("status", "open");
    const { data: bundle, error: bErr } = await supabase
      .from("payment_bundles")
      .insert({ tenant_id: link.tenant_id, customer_id: link.customer_id, token: link.token, items, total, currency, status: "open" })
      .select("id")
      .single();
    if (bErr || !bundle) throw new Error(`payment_bundles schrijven: ${bErr?.message ?? "geen rij"}`);
    params = {
      ...common,
      line_items: items.map((it) => ({
        price_data: {
          currency,
          product_data: { name: it.type === "cycle" ? `Betalingsverzoek ${it.number ?? it.id}` : `Factuur ${it.number ?? it.id}` },
          unit_amount: Math.round(it.amount * 100),
        },
        quantity: 1,
      })),
      // Bewust géén billing_cycle_id of invoice_id: de webhook boekt per post af via de bundel.
      metadata: { payment_bundle_id: bundle.id, tenant_id: link.tenant_id, payment_link_token: link.token },
      payment_intent_data: { metadata: { payment_bundle_id: bundle.id, tenant_id: link.tenant_id } },
    };
    const session = await ctx.stripe.checkout.sessions.create(params, ctx.requestOptions);
    await supabase.from("payment_bundles").update({ checkout_session_id: session.id }).eq("id", bundle.id);
    await supabase.from("payment_links").update({ last_checkout_session_id: session.id, last_opened_at: new Date().toISOString() }).eq("token", link.token);
    return session.url as string;
  }

  const session = await ctx.stripe.checkout.sessions.create(params, ctx.requestOptions);
  await supabase.from("payment_links").update({ last_checkout_session_id: session.id, last_opened_at: new Date().toISOString() }).eq("token", link.token);
  return session.url as string;
}

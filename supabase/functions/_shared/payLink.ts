// PAY-LINK-1 — de beslissingen achter de vaste betaallink, puur en zonder imports.
//
// Tot 01-10 was elke betaallink naar een klant een Stripe Checkout-sessie van
// ≤ 24 uur (of een machtigingslink van 7 dagen) — in mails, PDF's en op de
// facturatiepagina dus vaak dood. Nu: één vaste link per openstaande post,
// sellqo.app/betalen/<token>, die bij elke klik een verse sessie maakt.
//
// Principe (Akke): een factuur ontstaat pas ná betaling (pay_first). Een link
// betaalt een betaalverzoek (billing_cycle) of een al bestaande factuur; hij
// maakt zelf nooit een factuur. Dit bestand schrijft nergens heen.
//
// Gedeeld met vitest; de afboekcode (subscriptionCharge.ts) en de publieke
// functie pay-link gebruiken dezelfde beslissingen.

// ── Token ──────────────────────────────────────────────────────────────

/** Crockford-base32: geen i, l, o, u — niets dat je verkeerd overtypt. */
export const TOKEN_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
/** 26 tekens × 5 bit = 130 bit. Kort genoeg om van een PDF over te typen. */
export const TOKEN_LENGTH = 26;
const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

/** `random` is injecteerbaar voor de tests; standaard crypto.getRandomValues. */
export function generatePayToken(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 32 is een macht van 2: `byte & 31` geeft een gelijkmatige verdeling.
  return Array.from(random(TOKEN_LENGTH), (b) => TOKEN_ALPHABET[b & 31]).join("");
}

/** Overgetypte invoer → canoniek token, of null. Hoofdletters, spaties en streepjes mogen; i/l → 1, o → 0. */
export function normalizePayToken(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().toLowerCase().replace(/[\s-]/g, "").replace(/[il]/g, "1").replace(/o/g, "0");
  return TOKEN_RE.test(t) ? t : null;
}

export function payLinkUrl(token: string, baseUrl = "https://sellqo.app"): string {
  return `${baseUrl.replace(/\/$/, "")}/betalen/${token}`;
}

// ── Staat van een post ─────────────────────────────────────────────────

export type PayState = "open" | "paid" | "cancelled" | "processing" | "not_found";

/** Betaalbaar: ook `expired` — juist een verlopen verzoek moet een winkel uit de leesmodus kunnen halen. */
const OPEN_CYCLE = new Set(["pending", "awaiting_payment", "reopened", "expired"]);
const OPEN_INVOICE = new Set(["unpaid", "sent"]);

export function cycleState(cycle: { status: string; invoice_id?: string | null } | null | undefined): PayState {
  if (!cycle) return "not_found";
  if (cycle.status === "settled" || cycle.invoice_id) return "paid";
  if (cycle.status === "cancelled") return "cancelled";
  if (cycle.status === "processing") return "processing";
  return OPEN_CYCLE.has(cycle.status) ? "open" : "not_found";
}

export function invoiceState(invoice: { status: string } | null | undefined): PayState {
  if (!invoice) return "not_found";
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "cancelled") return "cancelled";
  if (invoice.status === "processing") return "processing";
  return OPEN_INVOICE.has(invoice.status) ? "open" : "not_found";
}

/**
 * Een vorige Checkout-sessie die volgens Stripe al `complete` is, maar die de
 * webhook nog niet afboekte: de klant heeft betaald. Dan nooit een tweede sessie.
 */
export function withPendingSession(state: PayState, previousSessionStatus: string | null | undefined): PayState {
  return state === "open" && previousSessionStatus === "complete" ? "processing" : state;
}

// ── Bundel ("Alles betalen") ───────────────────────────────────────────

export type BundleItemType = "cycle" | "invoice";
export interface BundleItem {
  type: BundleItemType;
  id: string;
  number: string | null;
  amount: number;
}

interface CycleRow { id: string; status: string; invoice_id?: string | null; total: number | string | null; payment_request_number?: string | null; customer_id?: string | null; tenant_id?: string | null }
interface InvoiceRow { id: string; status: string; total: number | string | null; invoice_number?: string | null; customer_id?: string | null; tenant_id?: string | null }

const money = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100) / 100;

/**
 * Alle open posten van één klant in één tenant, oudste eerst zoals aangeleverd.
 * Betaald, geannuleerd, in verwerking of van een andere klant/tenant: eruit.
 */
export function selectBundleItems(input: {
  tenantId: string;
  customerId: string;
  cycles: readonly CycleRow[];
  invoices: readonly InvoiceRow[];
}): { items: BundleItem[]; total: number } {
  const mine = (r: { customer_id?: string | null; tenant_id?: string | null }) =>
    r.customer_id === input.customerId && r.tenant_id === input.tenantId;
  const items: BundleItem[] = [
    ...input.cycles.filter((c) => mine(c) && cycleState(c) === "open" && money(c.total) > 0)
      .map((c) => ({ type: "cycle" as const, id: c.id, number: c.payment_request_number ?? null, amount: money(c.total) })),
    ...input.invoices.filter((i) => mine(i) && invoiceState(i) === "open" && money(i.total) > 0)
      .map((i) => ({ type: "invoice" as const, id: i.id, number: i.invoice_number ?? null, amount: money(i.total) })),
  ];
  return { items, total: money(items.reduce((s, i) => s + i.amount, 0)) };
}

/**
 * Elke post van een betaalde bundel één keer door dezelfde afboekcode als een
 * losse betaling. Een fout bij één post stopt de rest niet; de uitkomst per post
 * komt terug zodat de webhook kan loggen.
 */
export async function settleBundleItems(
  items: readonly BundleItem[],
  settle: (item: BundleItem) => Promise<void>,
): Promise<Array<{ item: BundleItem; ok: boolean; error?: string }>> {
  const seen = new Set<string>();
  const results: Array<{ item: BundleItem; ok: boolean; error?: string }> = [];
  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await settle(item);
      results.push({ item, ok: true });
    } catch (e) {
      results.push({ item, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

// ── Webhook: welke tak, en wat doen we met deze betaling? ──────────────

export type ChargeRoute = "cycle" | "invoice" | "bundle" | null;

/**
 * Alleen payment_intents met een billing-sleutel horen bij de afboeking.
 * Een webshopbetaling (stripe-connect-webhook) heeft die niet → null → de
 * webhook gaat door naar zijn eigen order-, checkout- en refundtakken.
 */
export function routeChargeEvent(eventType: string, metadata: Record<string, unknown> | null | undefined): ChargeRoute {
  if (eventType !== "payment_intent.succeeded" && eventType !== "payment_intent.payment_failed") return null;
  const m = metadata ?? {};
  // Volgorde gelijk aan de oude code: cyclus vóór factuur. Bundel eerst, want
  // die draagt bewust geen billing_cycle_id of invoice_id.
  if (typeof m.payment_bundle_id === "string" && m.payment_bundle_id) return "bundle";
  if (typeof m.billing_cycle_id === "string" && m.billing_cycle_id) return "cycle";
  if (typeof m.invoice_id === "string" && m.invoice_id) return "invoice";
  return null;
}

export type PaymentDecision = "settle" | "retry" | "duplicate" | "closed_item";

/**
 * Een geslaagde betaling op een post:
 * - open → afboeken;
 * - al betaald met dezelfde intent → webhook-retry, niets doen;
 * - al betaald met een andere intent → dubbele betaling: melden, niet afboeken;
 * - geannuleerd → betaling op een afgesloten post: melden, niet afboeken.
 * `paidIntentId` onbekend bij een betaalde post (van vóór PAY-LINK-1) → retry:
 * liever geen valse melding dan een onterechte.
 */
export function classifyPayment(post: { state: PayState; paidIntentId?: string | null }, intentId: string): PaymentDecision {
  if (post.state === "cancelled") return "closed_item";
  if (post.state === "paid") {
    if (!post.paidIntentId || post.paidIntentId === intentId) return "retry";
    return "duplicate";
  }
  return "settle";
}

// ── Branding van de betaalpagina ───────────────────────────────────────

export interface PayPageBrand {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  /** Een gewone winkel: klein "Mogelijk gemaakt door SellQo" onderaan. */
  poweredBySellqo: boolean;
}

/**
 * Wat de pagina van het merk mag zien: naam, logo, kleur. Geen e-mailadressen,
 * adressen of btw-nummers — die heeft een betaalpagina niet nodig.
 */
export function payPageBrand(brand: { tenantName: string; logoUrl?: string | null; primaryColor?: string | null }, isPlatform: boolean): PayPageBrand {
  return {
    name: brand.tenantName || "SellQo",
    logoUrl: brand.logoUrl || null,
    primaryColor: brand.primaryColor || "#1d3a5f",
    poweredBySellqo: !isPlatform,
  };
}

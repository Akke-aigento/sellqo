/**
 * MAIL-2a — pure hulpfuncties voor automationmails. Geen databank, geen netwerk:
 * gedeeld door de engine (automationEngine.ts), de worker (campaignQueue.ts renderFor)
 * en het voorbeeld (render-campaign-preview), en getest in automationVars.test.ts.
 */

import { escapeHtml } from "./marketingToken.ts";

/** Variabelen die enkel een automation vult. Die overschrijven altijd. */
export const AUTOMATION_VAR_KEYS = [
  "order_number",
  "review_url",
  "cart_url",
  "shop_url",
  "cart_items",
  "current_year",
] as const;

/** Klantvelden die een automation mag aanvullen als de klantrij ze niet heeft (bv. gast-afrekening). */
const FILL_KEYS = ["customer_first_name", "customer_last_name", "customer_name"] as const;

/** Deze waarden zijn al veilige HTML (door de engine opgebouwd met escaping); niet nog eens escapen. */
export const RAW_HTML_VAR_KEYS = new Set<string>(["cart_items"]);

/**
 * Voegt de variabelen van één automationmail (campaign_sends.variables) bij de gewone
 * variabelenmap. `runVars` null/leeg → exact de basismap (gewone campagnes veranderen niet).
 * Sleutels die met `_` beginnen (bv. `_consent`) zijn intern en komen nooit in de mail.
 */
export function mergeAutomationVars(
  base: Record<string, string>,
  runVars: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!runVars || typeof runVars !== "object") return base;
  const out: Record<string, string> = { ...base };
  for (const k of AUTOMATION_VAR_KEYS) {
    const v = runVars[k];
    if (typeof v === "string" || typeof v === "number") out[k] = String(v);
    else if (!(k in out)) out[k] = "";
  }
  // MAIL-CLEAN-1: {{current_year}} (vroeger {{JAAR}} in de eigen welkomstmail) vulde de engine
  // nooit; zonder deze regel stond er "© VanXcel" zonder jaartal.
  if (!out.current_year) out.current_year = String(new Date().getFullYear());
  for (const k of FILL_KEYS) {
    const v = runVars[k];
    if ((out[k] ?? "") === "" && typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  // customer_name valt in buildVariableMap terug op "Klant"; een echte voornaam uit de bestelling is beter.
  if (out.customer_name === "Klant" && typeof runVars.customer_first_name === "string" && runVars.customer_first_name.trim()) {
    out.customer_name = runVars.customer_first_name.trim();
  }
  return out;
}

/**
 * Exact de vorm die buildCartItemsHtml maakt: <ul> met <li>-regels zonder verdere tags (de namen
 * zijn daar al ge-escaped, dus bevatten geen < of >). Alles wat anders is, wordt ge-escaped.
 * Verdediging in de diepte: campaign_sends.variables schrijft enkel de server, maar een
 * ruwe HTML-variabele mag nooit op vertrouwen alleen rusten.
 */
// MAIL-2c: een regel mag de productnaam als link hebben (enkel https, zonder aanhalingstekens).
const SAFE_CART_ITEMS = /^<ul>(<li>[^<>]*(<a href="https:\/\/[^"<>\s]+">[^<>]*<\/a>[^<>]*)?<\/li>){1,10}<\/ul>$/;

/** HTML-veilige versie van de map: alles ge-escaped behalve de vooraf opgebouwde HTML-blokken. */
export function htmlSafeVars(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [
      k,
      RAW_HTML_VAR_KEYS.has(k) && (v === "" || SAFE_CART_ITEMS.test(v)) ? v : escapeHtml(v),
    ]),
  );
}

export interface ReviewConnection {
  platform: string | null;
  is_enabled: boolean | null;
  external_url: string | null;
  external_id?: string | null;
}

const REVIEW_PLATFORMS = ["google", "trustpilot"] as const;

/**
 * Reviewlink van de winkel (beslissing Akke 19-10): het gekoppelde Google- of Trustpilot-profiel
 * (review_platform_connections, ingeschakeld, met een http(s)-profiel-URL). Google eerst.
 * Geen link → null, en de engine slaat de reviewstap over.
 */
export function pickReviewUrl(connections: ReviewConnection[] | null | undefined): string | null {
  const list = (connections || []).filter((c) => c && c.is_enabled !== false);
  for (const platform of REVIEW_PLATFORMS) {
    const c = list.find((x) => (x.platform || "").toLowerCase() === platform);
    const url = (c?.external_url || "").trim();
    if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  }
  return null;
}

export interface CartLine {
  quantity: number | null;
  product_name: string | null;
  variant_title?: string | null;
  /** MAIL-2c: publieke productlink uit storefrontUrls.productUrlFor; null = geen link. */
  product_url?: string | null;
}

/**
 * Productlijst voor {{cart_items}}: max. 10 regels, namen ge-escaped. Leeg → "".
 * MAIL-2c: met een https-productlink wordt de naam een link; zonder link blijft het tekst.
 */
export function buildCartItemsHtml(lines: CartLine[] | null | undefined): string {
  const rows = (lines || []).filter((l) => (l.product_name || "").trim()).slice(0, 10);
  if (!rows.length) return "";
  const li = rows.map((l) => {
    const qty = Math.max(1, Math.floor(Number(l.quantity) || 1));
    const rawName = escapeHtml(String(l.product_name).trim());
    const url = (l.product_url || "").trim();
    const name = /^https:\/\/[^"'<>\s]+$/.test(url) ? `<a href="${escapeHtml(url)}">${rawName}</a>` : rawName;
    const variant = (l.variant_title || "").trim() ? ` (${escapeHtml(String(l.variant_title).trim())})` : "";
    return `<li>${qty} × ${name}${variant}</li>`;
  });
  return `<ul>${li.join("")}</ul>`;
}

/** Eerste woord van een volledige naam ("Jan Peeters" → "Jan"). */
export function firstNameOf(fullName: string | null | undefined): string {
  return String(fullName || "").trim().split(/\s+/)[0] || "";
}

/** Taal uit een locale als "nl-BE" → "nl"; enkel de talen van de mailteksten. */
export function shortLocale(v: unknown): "nl" | "en" | "fr" | "de" | null {
  const s = String(v || "").toLowerCase().slice(0, 2);
  return s === "nl" || s === "en" || s === "fr" || s === "de" ? s : null;
}

export type EnqueueOutcome =
  | { kind: "cancelled"; message: string }
  | { kind: "plan_limit"; limit: number; used: number }
  | { kind: "stale" }
  | { kind: "error"; message: string };

/** Fout van enqueue_automation_send vertalen naar wat de engine met de run doet. */
export function mapEnqueueError(message: string): EnqueueOutcome {
  const msg = message || "";
  const m = msg.match(/MAIL_PLAN_LIMIT:(\d+):(\d+)/);
  if (m) return { kind: "plan_limit", limit: Number(m[1]), used: Number(m[2]) };
  if (msg.includes("MAIL_UNSUBSCRIBED")) return { kind: "cancelled", message: "Uitgeschreven." };
  if (msg.includes("MAIL_NO_CONSENT")) return { kind: "cancelled", message: "Geen toestemming meer." };
  if (msg.includes("MAIL_INVALID_EMAIL")) return { kind: "cancelled", message: "Ongeldig e-mailadres." };
  if (msg.includes("MAIL_RUN_STATE") || msg.includes("MAIL_STEP_MISMATCH")) return { kind: "stale" };
  return { kind: "error", message: msg.slice(0, 500) };
}

/** Wachttijd na een onverwachte fout: 5, 10, 20, 40 min (daarna stopt de run). */
export function retryDelayMinutes(attempts: number): number {
  return 5 * 2 ** Math.max(0, Math.min(3, attempts - 1));
}

/** Tijdstip van een stap, zoals schedule_automation_run_v2 en automation_finish_step het rekenen. */
export function stepDueAt(triggerAt: Date, delayHours: number | null, delayMinutes: number | null, now: Date): Date {
  const due = new Date(triggerAt.getTime() + ((delayHours || 0) * 60 + (delayMinutes || 0)) * 60_000);
  return due < now ? now : due;
}

export const ORDER_PAID_STATUSES = ["paid", "partially_refunded"];

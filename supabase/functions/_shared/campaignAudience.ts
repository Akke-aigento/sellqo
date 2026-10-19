/**
 * MAIL-1a — wie krijgt een campagne? Eén bron voor tellen én versturen.
 *
 * Tot 19 okt 2026 telde de segmentpreview in de browser met andere filters dan
 * send-campaign-batch gebruikte, en drie filters (laatste bestelling, geen
 * bestelling sinds, engagement) werden genegeerd: een "win-back" mailde iedereen.
 * Nu gebruiken de telling in de admin, het versturen en de worker allemaal deze
 * functie.
 *
 * Altijd: enkel `email_subscribed = true`, nooit wie in `email_unsubscribes` staat
 * (uitgeschreven, hard bounce of klacht), elk adres één keer.
 */

// deno-lint-ignore no-explicit-any
type Db = any;

import { resolvePresetRules } from "./audiencePresets.ts";

export interface AudienceInput {
  tenantId: string;
  filterRules?: Record<string, unknown> | null;
  presetKey?: string | null;
  /** Taal van een eentalige campagne; null/undefined = geen taalfilter. */
  language?: string | null;
  /** Standaardtaal van de winkel: klanten zonder voorkeur tellen als die taal. */
  tenantLocale?: string | null;
  /** Meertalige campagne: geen taalfilter, elke ontvanger krijgt zijn variant. */
  multiLanguage?: boolean;
}

export interface AudienceRecipient {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  vat_number: string | null;
  billing_city: string | null;
  billing_country: string | null;
  total_orders: number | null;
  total_spent: number | null;
  tags: string[] | null;
  created_at: string;
  preferred_language: string | null;
}

const RECIPIENT_COLUMNS =
  "id, email, first_name, last_name, company_name, phone, vat_number, billing_city, billing_country, total_orders, total_spent, tags, created_at, preferred_language";

const PAGE = 1000;

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;

/** Klant-id's met een bestelling sinds `sinceIso` (alle statussen behalve geannuleerd). */
async function customersWithOrderSince(db: Db, tenantId: string, sinceIso: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("orders")
      .select("customer_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", sinceIso)
      .neq("status", "cancelled")
      .not("customer_id", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`orders lezen mislukt: ${error.message}`);
    for (const r of data || []) if (r.customer_id) ids.add(r.customer_id as string);
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

function applyRules(q: Db, input: AudienceInput) {
  const preset = resolvePresetRules(input.presetKey);
  if (preset) {
    if (preset.customer_type) q = q.eq("customer_type", preset.customer_type);
    if (typeof preset.min_orders === "number") q = q.gte("total_orders", preset.min_orders);
    if (typeof preset.max_orders === "number") q = q.lte("total_orders", preset.max_orders);
    if (typeof preset.created_after === "string") q = q.gte("created_at", preset.created_after);
  }

  const rules = input.filterRules || {};
  if (rules.customer_type && rules.customer_type !== "all") q = q.eq("customer_type", rules.customer_type as string);
  if (Array.isArray(rules.countries) && rules.countries.length) q = q.in("billing_country", rules.countries as string[]);
  const minOrders = num(rules.min_orders);
  if (minOrders !== null) q = q.gte("total_orders", minOrders);
  const maxOrders = num(rules.max_orders);
  if (maxOrders !== null) q = q.lte("total_orders", maxOrders);
  const minSpent = num(rules.min_total_spent);
  if (minSpent !== null) q = q.gte("total_spent", minSpent);
  const maxSpent = num(rules.max_total_spent);
  if (maxSpent !== null) q = q.lte("total_spent", maxSpent);
  if (Array.isArray(rules.tags) && rules.tags.length) {
    q = rules.tags_match === "all" ? q.contains("tags", rules.tags as string[]) : q.overlaps("tags", rules.tags as string[]);
  }
  if (typeof rules.created_after === "string" && rules.created_after) q = q.gte("created_at", rules.created_after);
  if (typeof rules.created_before === "string" && rules.created_before) q = q.lte("created_at", rules.created_before);
  if (typeof rules.preferred_language === "string" && rules.preferred_language) {
    q = q.eq("preferred_language", rules.preferred_language as string);
  }
  const minEngagement = num(rules.min_engagement_score);
  if (minEngagement !== null) q = q.gte("email_engagement_score", minEngagement);
  // rules.email_subscribed === false wordt bewust genegeerd: wie uitgeschreven is, krijgt nooit marketing.

  if (input.language && !input.multiLanguage) {
    q = input.language === input.tenantLocale
      ? q.or(`preferred_language.eq.${input.language},preferred_language.is.null`)
      : q.eq("preferred_language", input.language);
  }
  return q;
}

/** Alle ontvangers van een campagne of segment, na alle filters en uitsluitingen. */
export async function resolveAudience(db: Db, input: AudienceInput): Promise<AudienceRecipient[]> {
  const rules = input.filterRules || {};
  const preset = resolvePresetRules(input.presetKey);

  // Filters op bestelrecentheid: geen kolom op customers, dus via orders.
  const lastOrderDays = num(rules.last_order_days_ago); // besteld in de laatste X dagen
  const noOrderSince = num(rules.no_order_since_days) ?? (typeof preset?.no_order_since_days === "number" ? preset.no_order_since_days : null);
  const mustHaveRecent = lastOrderDays !== null ? await customersWithOrderSince(db, input.tenantId, daysAgoIso(lastOrderDays)) : null;
  const mustNotHaveRecent = noOrderSince !== null ? await customersWithOrderSince(db, input.tenantId, daysAgoIso(noOrderSince)) : null;

  // Uitgeschreven, hard gebounced of klacht: nooit mailen.
  const blocked = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("email_unsubscribes")
      .select("email")
      .eq("tenant_id", input.tenantId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`uitschrijvingen lezen mislukt: ${error.message}`);
    for (const r of data || []) if (r.email) blocked.add(String(r.email).trim().toLowerCase());
    if (!data || data.length < PAGE) break;
  }

  const seen = new Set<string>();
  const out: AudienceRecipient[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from("customers")
      .select(RECIPIENT_COLUMNS)
      .eq("tenant_id", input.tenantId)
      .eq("email_subscribed", true)
      .not("email", "is", null);
    q = applyRules(q, input);
    const { data, error } = await q.order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`klanten lezen mislukt: ${error.message}`);
    for (const r of (data || []) as AudienceRecipient[]) {
      const email = String(r.email || "").trim().toLowerCase();
      if (!email || !email.includes("@") || blocked.has(email) || seen.has(email)) continue;
      if (mustHaveRecent && !mustHaveRecent.has(r.id)) continue;
      if (mustNotHaveRecent && mustNotHaveRecent.has(r.id)) continue;
      seen.add(email);
      out.push({ ...r, email });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

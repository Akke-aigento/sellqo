// MAIL-BILLING-1 — facturatie-API voor Studio Akke Mail (server-to-server).
//
// Waarom dit bestaat: Studio Akke Mail (aparte app, repo nomadix-mail-app)
// factureert zijn klanten via SellQo, in één eigen tenant "Studio Akke". Die app
// moet klanten en abonnementen kunnen aanmaken, wijzigen, opzeggen en de
// betaalstatus kunnen opvragen — zonder gebruikerssessie in SellQo.
//
// Wat deze functie NIET doet: iets aan de bestaande facturatiemotor veranderen.
// Ze schrijft rijen in precies dezelfde vorm als de admin-UI en sync-tenant-plan,
// en laat de rest over aan de bestaande keten:
//   - generate-subscription-invoices maakt de cycli (pay_first) en start de incasso;
//   - de Stripe-webhook maakt de factuur en zet de cyclus op settled;
//   - process-cycle-reminders stuurt de herinneringen.
// Het mandaat loopt via _shared/mandateToken.ts (dezelfde helper als
// create-mandate-setup), de opstartfactuur via de bestaande functie
// create-manual-invoice (aangeroepen met de service role).
//
// Auth: kop `x-mail-billing-secret`, tijdsconstant vergeleken met
// internal_config.mail_billing_secret. De tenant komt uit
// internal_config.mail_billing_tenant_id — nooit uit het verzoek. Elke
// klant/abonnement-id uit het verzoek wordt tegen die tenant gecontroleerd,
// en alleen klanten met external_id 'mail:%' zijn bereikbaar.
//
// Contract: altijd JSON, `{ ok: true, ... }` of `{ ok: false, code, error }`.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";
import { mintMandateSetupLink } from "../_shared/mandateToken.ts";
import { resolveBillingState, addDays, toISODate } from "../_shared/billingState.ts";
import { computeVatTotals } from "../_shared/billingMoney.ts";
import { callVies, cleanVatNumber, parseVatCountry, isEuCountry } from "../_shared/vies.ts";

const SECRET_HEADER = "x-mail-billing-secret";
const CONFIG_SECRET_KEY = "mail_billing_secret";
const CONFIG_TENANT_KEY = "mail_billing_tenant_id";

const EXTERNAL_PREFIX = "mail:";
const SUB_NAME_PREFIX = "Studio Akke Mail — ";

const VAT_RATE = 21;
const PAYMENT_TERM_DAYS = 7;
// Zelfde waarde als sync-tenant-plan: de cyclus wordt 5 dagen vóór de
// periodestart aangemaakt, zodat het betaalverzoek op tijd vertrekt.
const GENERATE_DAYS_BEFORE = 5;
const SETUP_FEE_EXCL_VAT = 150;

type Formule = "start" | "zaak";
type Ritme = "maand" | "jaar";

/** Prijzen exclusief btw. */
const PRICES: Record<Formule, Record<Ritme, number>> = {
  start: { maand: 10, jaar: 100 },
  zaak: { maand: 20, jaar: 200 },
};

const FORMULE_LABEL: Record<Formule, string> = { start: "Start", zaak: "Zaak" };

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MAIL-BILLING-API] ${step}${suffix}`);
};

// ── Antwoorden ───────────────────────────────────────────────────────

class ApiError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fail = (err: ApiError) =>
  json({ ok: false, code: err.code, error: err.message, ...(err.extra ?? {}) }, err.status);

// ── Validatie ────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bad = (message: string) => new ApiError(400, "ongeldige_invoer", message);

function reqUuid(body: Record<string, unknown>, field: string): string {
  const v = body[field];
  if (typeof v !== "string" || !UUID_RE.test(v)) throw bad(`${field} moet een uuid zijn`);
  return v.toLowerCase();
}

function reqString(body: Record<string, unknown>, field: string, max = 255): string {
  const v = body[field];
  if (typeof v !== "string" || !v.trim()) throw bad(`${field} is verplicht`);
  if (v.trim().length > max) throw bad(`${field} is te lang (max ${max})`);
  return v.trim();
}

function optString(value: unknown, field: string, max = 255): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw bad(`${field} moet tekst zijn`);
  const t = value.trim();
  if (t.length > max) throw bad(`${field} is te lang (max ${max})`);
  return t || null;
}

function reqEnum<T extends string>(body: Record<string, unknown>, field: string, allowed: readonly T[]): T {
  const v = body[field];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw bad(`${field} moet een van ${allowed.join(", ")} zijn`);
  }
  return v as T;
}

function reqDate(body: Record<string, unknown>, field: string): string {
  const v = body[field];
  if (typeof v !== "string" || !DATE_RE.test(v)) throw bad(`${field} moet YYYY-MM-DD zijn`);
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw bad(`${field} is geen geldige datum`);
  return v;
}

/** Vergelijkt zonder vroegtijdig af te breken (kopie van _shared/cronAuth.ts, daar niet geëxporteerd). */
function constantTimeEquals(a: string, b: string): boolean {
  let mismatch = a.length !== b.length ? 1 : 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── Gedeelde lookups ─────────────────────────────────────────────────

type BillingTenant = {
  id: string;
  name: string;
  is_demo: boolean | null;
  is_internal_tenant: boolean | null;
  stripe_account_id: string | null;
};

type MailCustomer = {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  external_id: string | null;
  preferred_language: string | null;
};

const CUSTOMER_COLS =
  "id, tenant_id, email, first_name, last_name, company_name, external_id, preferred_language";

async function loadMailCustomer(admin: SupabaseClient, tenantId: string, customerId: string): Promise<MailCustomer> {
  const { data, error } = await admin
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("id", customerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !String(data.external_id ?? "").startsWith(EXTERNAL_PREFIX)) {
    throw new ApiError(404, "niet_gevonden", "Klant niet gevonden");
  }
  return data as MailCustomer;
}

type MailSubscription = {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  interval: string;
  status: string | null;
  start_date: string;
  end_date: string | null;
  next_invoice_date: string;
  last_invoice_date: string | null;
};

const SUB_COLS =
  "id, tenant_id, customer_id, name, interval, status, start_date, end_date, next_invoice_date, last_invoice_date";

async function loadMailSubscription(
  admin: SupabaseClient,
  tenantId: string,
  subscriptionId: string,
): Promise<{ sub: MailSubscription; customer: MailCustomer }> {
  const { data, error } = await admin
    .from("subscriptions")
    .select(SUB_COLS)
    .eq("id", subscriptionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !String(data.name ?? "").startsWith(SUB_NAME_PREFIX)) {
    throw new ApiError(404, "niet_gevonden", "Abonnement niet gevonden");
  }
  // Ook de klant moet een mail-klant van deze tenant zijn.
  const customer = await loadMailCustomer(admin, tenantId, data.customer_id);
  return { sub: data as MailSubscription, customer };
}

const isEnded = (sub: Pick<MailSubscription, "status">) => sub.status === "cancelled" || sub.status === "ended";

function planLine(formule: Formule, ritme: Ritme, lang: string | null) {
  const en = lang === "en";
  const per = ritme === "maand" ? (en ? "per month" : "per maand") : (en ? "per year" : "per jaar");
  const unitPrice = PRICES[formule][ritme];
  const totals = computeVatTotals([{ net: unitPrice, vatRate: VAT_RATE }]);
  return {
    subName: `${SUB_NAME_PREFIX}${FORMULE_LABEL[formule]}`,
    description: `Studio Akke Mail ${FORMULE_LABEL[formule]} (${per})`,
    interval: ritme === "maand" ? "monthly" : "yearly",
    unitPrice,
    totals,
  };
}

async function activeMandate(admin: SupabaseClient, tenantId: string, customerId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("customer_payment_mandates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("status", "active")
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

async function mintLink(
  admin: SupabaseClient,
  tenant: BillingTenant,
  customer: MailCustomer,
  subscriptionId: string | null,
): Promise<string> {
  try {
    const ctx = getStripeContext(tenant);
    const { url } = await mintMandateSetupLink(admin, ctx, {
      tenant,
      customer,
      subscriptionId,
      baseUrl: null, // server-to-server: PUBLIC_APP_URL
    });
    return url;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("Mandate link failed", { customer_id: customer.id, message });
    throw new ApiError(502, "mandaat_mislukt", `Mandaatlink kon niet aangemaakt worden: ${message}`);
  }
}

// ── Acties ───────────────────────────────────────────────────────────

async function upsertCustomer(admin: SupabaseClient, tenant: BillingTenant, body: Record<string, unknown>) {
  const mailOrgId = reqUuid(body, "mail_org_id");
  const bedrijf = reqString(body, "bedrijf");
  const email = reqString(body, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad("email is ongeldig");
  const taal = reqEnum(body, "taal", ["nl", "en"] as const);
  const btwRaw = optString(body.btw, "btw", 32);

  let adres: { straat: string | null; postcode: string | null; gemeente: string | null; land: string | null } | null =
    null;
  if (body.adres !== undefined && body.adres !== null) {
    if (typeof body.adres !== "object" || Array.isArray(body.adres)) throw bad("adres moet een object zijn");
    const a = body.adres as Record<string, unknown>;
    const land = optString(a.land, "adres.land", 2);
    if (land && !/^[A-Za-z]{2}$/.test(land)) throw bad("adres.land moet een ISO-landcode van 2 letters zijn");
    adres = {
      straat: optString(a.straat, "adres.straat"),
      postcode: optString(a.postcode, "adres.postcode", 20),
      gemeente: optString(a.gemeente, "adres.gemeente"),
      land: land ? land.toUpperCase() : null,
    };
  }

  const externalId = `${EXTERNAL_PREFIX}${mailOrgId}`;
  const vatNumber = btwRaw ? cleanVatNumber(btwRaw) : null;

  // Bestaande klant: eerst op external_id, anders op e-mail (uniek per tenant)
  // zolang die klant nog aan niets anders gekoppeld is.
  const { data: byExternal, error: extErr } = await admin
    .from("customers")
    .select("id, external_id, vat_number, vat_verified")
    .eq("tenant_id", tenant.id)
    .eq("external_id", externalId)
    .limit(1);
  if (extErr) throw extErr;
  let existing = byExternal?.[0] ?? null;

  if (!existing) {
    const { data: byEmail, error: emailErr } = await admin
      .from("customers")
      .select("id, external_id, vat_number, vat_verified")
      .eq("tenant_id", tenant.id)
      .eq("email", email)
      .limit(1);
    if (emailErr) throw emailErr;
    const hit = byEmail?.[0] ?? null;
    if (hit) {
      if (hit.external_id && hit.external_id !== externalId) {
        throw new ApiError(409, "email_in_gebruik", "Dit e-mailadres hoort al bij een andere klant in de facturatietenant");
      }
      existing = hit;
    }
  }

  const fields: Record<string, unknown> = {
    tenant_id: tenant.id,
    external_id: externalId,
    customer_type: "b2b",
    company_name: bedrijf,
    email,
    preferred_language: taal,
    vat_number: vatNumber,
  };
  if (adres) {
    fields.billing_street = adres.straat;
    fields.billing_postal_code = adres.postcode;
    fields.billing_city = adres.gemeente;
    fields.billing_country = adres.land;
  } else if (body.adres === null) {
    fields.billing_street = null;
    fields.billing_postal_code = null;
    fields.billing_city = null;
    fields.billing_country = null;
  }

  // VIES: best effort, blokkeert nooit. Alleen een definitieve uitkomst wordt
  // weggeschreven; een onbeschikbare dienst laat de bestaande status staan.
  const vatChanged = !existing || existing.vat_number !== vatNumber;
  if (!vatNumber) {
    fields.vat_verified = false;
    fields.vat_verified_at = null;
  } else if (vatChanged || existing?.vat_verified !== true) {
    const { countryCode, number } = parseVatCountry(vatNumber);
    if (isEuCountry(countryCode)) {
      try {
        const res = await callVies(countryCode, number);
        if (!res.service_unavailable) {
          fields.vat_verified = res.valid;
          fields.vat_verified_at = new Date().toISOString();
        } else if (vatChanged) {
          fields.vat_verified = false;
          fields.vat_verified_at = null;
        }
        log("VIES", { valid: res.valid, unavailable: !!res.service_unavailable });
      } catch (e) {
        log("VIES error (non-blocking)", { message: e instanceof Error ? e.message : String(e) });
        if (vatChanged) {
          fields.vat_verified = false;
          fields.vat_verified_at = null;
        }
      }
    } else if (vatChanged) {
      fields.vat_verified = false;
      fields.vat_verified_at = null;
    }
  }

  if (existing) {
    const { error } = await admin.from("customers").update(fields).eq("id", existing.id).eq("tenant_id", tenant.id);
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ApiError(409, "email_in_gebruik", "Dit e-mailadres hoort al bij een andere klant in de facturatietenant");
      }
      throw error;
    }
    log("Customer updated", { customer_id: existing.id });
    return { ok: true, customer_id: existing.id };
  }

  const { data: created, error: insErr } = await admin.from("customers").insert(fields).select("id").single();
  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") {
      // Gelijktijdige aanroep won de race: haal de rij op die er nu staat.
      const { data: again } = await admin
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("external_id", externalId)
        .limit(1);
      if (again?.[0]) return { ok: true, customer_id: again[0].id };
      throw new ApiError(409, "email_in_gebruik", "Dit e-mailadres hoort al bij een andere klant in de facturatietenant");
    }
    throw insErr;
  }
  log("Customer created", { customer_id: created.id });
  return { ok: true, customer_id: created.id };
}

async function findSetupInvoice(admin: SupabaseClient, tenantId: string, customerId: string, subscriptionId: string) {
  const { data, error } = await admin
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .contains("metadata", { mail_billing_setup_for: subscriptionId })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function createSetupInvoice(
  admin: SupabaseClient,
  tenantId: string,
  customerId: string,
  subscriptionId: string,
  lang: string | null,
): Promise<string> {
  const description = lang === "en" ? "Installation Studio Akke Mail" : "Installatie Studio Akke Mail";
  // Bestaande functie, ongewijzigd: service-role-aanroep passeert authenticateRequest
  // via de service-role-bypass (_shared/auth.ts). Standaard send_email=false: de
  // factuur landt als concept.
  const { data, error } = await admin.functions.invoke("create-manual-invoice", {
    body: {
      tenant_id: tenantId,
      customer_id: customerId,
      items: [{ description, quantity: 1, unit_price: SETUP_FEE_EXCL_VAT, total_price: SETUP_FEE_EXCL_VAT }],
      // Opstartfactuur meteen versturen, net als de periodieke facturen (auto_send).
      send_email: true,
    },
  });
  const invoiceId = (data as { invoice_id?: string } | null)?.invoice_id;
  if (error || !invoiceId) {
    const message = error instanceof Error ? error.message : (data as { error?: string } | null)?.error ?? "geen invoice_id";
    throw new ApiError(502, "opstartfactuur_mislukt", `Opstartfactuur kon niet aangemaakt worden: ${message}`, {
      subscription_id: subscriptionId,
    });
  }

  // Markering voor idempotentie: een tweede create_subscription vindt deze factuur terug.
  const { data: inv, error: readErr } = await admin.from("invoices").select("metadata").eq("id", invoiceId).maybeSingle();
  if (readErr) throw readErr;
  const metadata = { ...((inv?.metadata as Record<string, unknown> | null) ?? {}), mail_billing_setup_for: subscriptionId };
  const { error: markErr } = await admin.from("invoices").update({ metadata }).eq("id", invoiceId).eq("tenant_id", tenantId);
  if (markErr) {
    throw new ApiError(500, "interne_fout", `Opstartfactuur ${invoiceId} aangemaakt maar niet gemarkeerd: ${markErr.message}`, {
      subscription_id: subscriptionId,
      setup_invoice_id: invoiceId,
    });
  }
  log("Setup invoice created", { invoice_id: invoiceId, subscription_id: subscriptionId });
  return invoiceId;
}

async function createSubscription(admin: SupabaseClient, tenant: BillingTenant, body: Record<string, unknown>) {
  const customerId = reqUuid(body, "customer_id");
  const formule = reqEnum(body, "formule", ["start", "zaak"] as const);
  const ritme = reqEnum(body, "ritme", ["maand", "jaar"] as const);
  const opstart = reqEnum(body, "opstart", ["aanrekenen", "gratis"] as const);
  const start = reqDate(body, "start");

  // Een startdatum in het verleden laat de runner inhaalcycli aanmaken. Eén dag
  // speling voor tijdzoneverschil tussen de aanroeper en UTC.
  const today = toISODate(new Date());
  if (start < addDays(today, -1)) throw bad("start mag niet in het verleden liggen");

  const customer = await loadMailCustomer(admin, tenant.id, customerId);
  const plan = planLine(formule, ritme, customer.preferred_language);

  // Idempotent: een lopend abonnement van deze API voor deze klant wordt teruggegeven.
  const { data: existingSubs, error: exErr } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", customer.id)
    .like("name", `${SUB_NAME_PREFIX}%`)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (exErr) throw exErr;

  let subscriptionId: string;
  let reused = false;
  if (existingSubs?.[0]) {
    subscriptionId = existingSubs[0].id;
    reused = true;
    log("Existing subscription reused", { subscription_id: subscriptionId });
  } else {
    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        name: plan.subName,
        interval: plan.interval,
        interval_count: 1,
        start_date: start,
        next_invoice_date: start,
        billing_anchor_day: Number(start.slice(8, 10)),
        status: "active",
        billing_model: "pay_first",
        payment_mode: "mandate",
        auto_send: true,
        payment_term_days: PAYMENT_TERM_DAYS,
        generate_days_before: GENERATE_DAYS_BEFORE,
        subtotal: plan.totals.subtotal,
        vat_total: plan.totals.vatAmount,
        total: plan.totals.total,
      })
      .select("id")
      .single();
    if (subErr) throw subErr;
    subscriptionId = sub.id;

    const { error: lineErr } = await admin.from("subscription_lines").insert({
      subscription_id: subscriptionId,
      description: plan.description,
      quantity: 1,
      unit_price: plan.unitPrice,
      vat_rate: VAT_RATE,
      sort_order: 0,
    });
    if (lineErr) {
      // Een abonnement zonder lijn slaat de runner stil over; ruim de eigen,
      // net aangemaakte rij op zodat een nieuwe poging schoon begint.
      await admin.from("subscriptions").delete().eq("id", subscriptionId).eq("tenant_id", tenant.id);
      throw lineErr;
    }
    log("Subscription created", { subscription_id: subscriptionId, formule, ritme, start });
  }

  let setupInvoiceId: string | null = null;
  if (opstart === "aanrekenen") {
    setupInvoiceId = await findSetupInvoice(admin, tenant.id, customer.id, subscriptionId);
    if (!setupInvoiceId) {
      setupInvoiceId = await createSetupInvoice(admin, tenant.id, customer.id, subscriptionId, customer.preferred_language);
    }
  }

  let mandateUrl: string | null = null;
  if (!(await activeMandate(admin, tenant.id, customer.id))) {
    try {
      mandateUrl = await mintLink(admin, tenant, customer, subscriptionId);
    } catch (e) {
      if (e instanceof ApiError) {
        e.extra = { ...(e.extra ?? {}), subscription_id: subscriptionId, setup_invoice_id: setupInvoiceId };
      }
      throw e;
    }
  }

  return { ok: true, subscription_id: subscriptionId, mandate_url: mandateUrl, setup_invoice_id: setupInvoiceId, reused };
}

async function changePlan(admin: SupabaseClient, tenant: BillingTenant, body: Record<string, unknown>) {
  const subscriptionId = reqUuid(body, "subscription_id");
  const formule = reqEnum(body, "formule", ["start", "zaak"] as const);
  const ritme = reqEnum(body, "ritme", ["maand", "jaar"] as const);

  const { sub, customer } = await loadMailSubscription(admin, tenant.id, subscriptionId);
  if (isEnded(sub) || sub.end_date) {
    throw new ApiError(409, "abonnement_beeindigd", "Abonnement is opgezegd of beëindigd");
  }

  const { data: lines, error: linesErr } = await admin
    .from("subscription_lines")
    .select("id")
    .eq("subscription_id", sub.id);
  if (linesErr) throw linesErr;
  if ((lines ?? []).length !== 1) {
    throw new ApiError(409, "onverwachte_lijnen", `Abonnement heeft ${(lines ?? []).length} lijnen, verwacht 1`);
  }

  const plan = planLine(formule, ritme, customer.preferred_language);

  // Geldt vanaf de volgende cyclus: de runner leest lijnen en interval pas bij het
  // aanmaken van de volgende billing_cycle; de lopende periode blijft ongemoeid.
  const { error: lineErr } = await admin
    .from("subscription_lines")
    .update({ description: plan.description, unit_price: plan.unitPrice, quantity: 1, vat_rate: VAT_RATE })
    .eq("id", lines![0].id)
    .eq("subscription_id", sub.id);
  if (lineErr) throw lineErr;

  const { error: subErr } = await admin
    .from("subscriptions")
    .update({
      name: plan.subName,
      interval: plan.interval,
      subtotal: plan.totals.subtotal,
      vat_total: plan.totals.vatAmount,
      total: plan.totals.total,
    })
    .eq("id", sub.id)
    .eq("tenant_id", tenant.id);
  if (subErr) throw subErr;

  log("Plan changed", { subscription_id: sub.id, formule, ritme });
  return { ok: true, geldt_vanaf: sub.next_invoice_date };
}

async function cancelSubscription(admin: SupabaseClient, tenant: BillingTenant, body: Record<string, unknown>) {
  const subscriptionId = reqUuid(body, "subscription_id");
  const { sub } = await loadMailSubscription(admin, tenant.id, subscriptionId);

  // Idempotent: een tweede opzegging geeft dezelfde einddatum terug.
  if (sub.end_date) return { ok: true, end_date: sub.end_date };

  const today = toISODate(new Date());

  if (isEnded(sub)) {
    return { ok: true, end_date: today };
  }

  // Nog nooit een cyclus aangemaakt (de runner zet last_invoice_date zodra hij er
  // een maakt): er is niets betaald of lopend, dus meteen stoppen.
  if (!sub.last_invoice_date) {
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "cancelled", end_date: today })
      .eq("id", sub.id)
      .eq("tenant_id", tenant.id);
    if (error) throw error;
    log("Cancelled before first cycle", { subscription_id: sub.id });
    return { ok: true, end_date: today };
  }

  // Lopende periode = [last_invoice_date, next_invoice_date). De runner slaat een
  // abonnement over zodra end_date < next_invoice_date, dus de dag vóór
  // next_invoice_date is de laatste dag; status blijft 'active' tot dan.
  const endDate = addDays(sub.next_invoice_date, -1);
  const { error } = await admin
    .from("subscriptions")
    .update({ end_date: endDate })
    .eq("id", sub.id)
    .eq("tenant_id", tenant.id);
  if (error) throw error;
  log("Cancelled at period end", { subscription_id: sub.id, end_date: endDate });
  return { ok: true, end_date: endDate };
}

async function subscriptionStatus(admin: SupabaseClient, tenant: BillingTenant, body: Record<string, unknown>) {
  const subscriptionId = reqUuid(body, "subscription_id");
  const { sub, customer } = await loadMailSubscription(admin, tenant.id, subscriptionId);
  const now = new Date();
  const today = toISODate(now);

  const { data: cycles, error: cyclesErr } = await admin
    .from("billing_cycles")
    .select("id, status, due_date, grace_until, total, invoice_id, checkout_session_url, payment_request_number, period_start, updated_at")
    .eq("subscription_id", sub.id)
    .eq("tenant_id", tenant.id)
    .order("period_start", { ascending: true });
  if (cyclesErr) throw cyclesErr;
  const all = cycles ?? [];

  const resolved = resolveBillingState({ cycles: all, now });

  // Oudste openstaande vervaldag, met dezelfde definitie van "open" als resolveBillingState.
  const OPEN = new Set(["awaiting_payment", "reopened", "expired"]);
  const openDue = all
    .filter((c) => OPEN.has(c.status) && !c.invoice_id && c.due_date)
    .map((c) => c.due_date as string)
    .sort();
  const oudsteVervaldag = openDue[0] ?? null;
  const dagenAchterstallig = oudsteVervaldag
    ? Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${oudsteVervaldag}T00:00:00Z`)) / 86_400_000))
    : 0;

  // Laatst betaald: de betaaldatum van de factuur van de jongste settled cyclus.
  const settled = all.filter((c) => c.status === "settled");
  let laatstBetaald: string | null = null;
  const invoiceIds = settled.map((c) => c.invoice_id).filter((id): id is string => !!id);
  if (invoiceIds.length > 0) {
    const { data: invs, error: invErr } = await admin
      .from("invoices")
      .select("paid_at")
      .in("id", invoiceIds)
      .eq("tenant_id", tenant.id)
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1);
    if (invErr) throw invErr;
    if (invs?.[0]?.paid_at) laatstBetaald = toISODate(invs[0].paid_at);
  }
  if (!laatstBetaald && settled.length > 0) {
    laatstBetaald = toISODate(settled[settled.length - 1].updated_at);
  }

  let state: "active" | "past_due" | "restricted" | "suspended" | "cancelled" | "pending";
  if (isEnded(sub) || (sub.end_date && sub.end_date < today)) {
    state = "cancelled";
  } else if (resolved.state === "past_due" || resolved.state === "restricted" || resolved.state === "suspended") {
    state = resolved.state;
  } else if (settled.length === 0) {
    // Nog nooit iets betaald en niets achterstallig: wacht op de eerste betaling.
    state = "pending";
  } else {
    state = "active";
  }

  return {
    ok: true,
    state,
    oudste_vervaldag: oudsteVervaldag,
    dagen_achterstallig: dagenAchterstallig,
    laatst_betaald: laatstBetaald,
    mandaat_actief: await activeMandate(admin, tenant.id, customer.id),
  };
}

async function mandateLink(admin: SupabaseClient, tenant: BillingTenant, body: Record<string, unknown>) {
  const customerId = reqUuid(body, "customer_id");
  const customer = await loadMailCustomer(admin, tenant.id, customerId);

  // Koppel de context aan het lopende abonnement, zodat de machtigingspagina
  // bedrag en reden toont (MANDATE-CTX-1).
  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", customer.id)
    .like("name", `${SUB_NAME_PREFIX}%`)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;

  const url = await mintLink(admin, tenant, customer, subs?.[0]?.id ?? null);
  return { ok: true, mandate_url: url };
}

// ── Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, code: "methode_niet_toegestaan", error: "Alleen POST" }, 405);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: config, error: cfgErr } = await admin
      .from("internal_config")
      .select("key, value")
      .in("key", [CONFIG_SECRET_KEY, CONFIG_TENANT_KEY]);
    if (cfgErr) {
      log("Config read failed", { message: cfgErr.message });
      return fail(new ApiError(500, "interne_fout", "Configuratie kon niet gelezen worden"));
    }
    const cfg = new Map((config ?? []).map((r) => [r.key as string, String(r.value ?? "").trim()]));
    const expectedSecret = cfg.get(CONFIG_SECRET_KEY) ?? "";
    const tenantId = cfg.get(CONFIG_TENANT_KEY) ?? "";

    if (!expectedSecret) {
      return fail(new ApiError(503, "niet_ingesteld", "Facturatiekoppeling is niet ingesteld"));
    }

    const provided = req.headers.get(SECRET_HEADER) ?? "";
    if (!provided || !constantTimeEquals(provided, expectedSecret)) {
      return fail(new ApiError(401, "niet_geautoriseerd", "Ongeldig of ontbrekend geheim"));
    }

    // Pas ná geldige auth vertellen we iets over de tenantconfiguratie.
    if (!tenantId || !UUID_RE.test(tenantId)) {
      return fail(new ApiError(503, "niet_ingesteld", "Facturatietenant is niet ingesteld"));
    }
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .select("id, name, is_demo, is_internal_tenant, stripe_account_id")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) {
      return fail(new ApiError(503, "niet_ingesteld", "Facturatietenant bestaat niet"));
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("geen object");
      body = parsed as Record<string, unknown>;
    } catch {
      throw bad("Body moet een JSON-object zijn");
    }

    const action = body.action;
    log("Action", { action });
    let result: Record<string, unknown>;
    switch (action) {
      case "upsert_customer":
        result = await upsertCustomer(admin, tenant as BillingTenant, body);
        break;
      case "create_subscription":
        result = await createSubscription(admin, tenant as BillingTenant, body);
        break;
      case "change_plan":
        result = await changePlan(admin, tenant as BillingTenant, body);
        break;
      case "cancel":
        result = await cancelSubscription(admin, tenant as BillingTenant, body);
        break;
      case "status":
        result = await subscriptionStatus(admin, tenant as BillingTenant, body);
        break;
      case "mandate_link":
        result = await mandateLink(admin, tenant as BillingTenant, body);
        break;
      default:
        throw bad("Onbekende action");
    }
    return json(result, 200);
  } catch (err) {
    if (err instanceof ApiError) return fail(err);
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
    log("ERROR", { message });
    return fail(new ApiError(500, "interne_fout", message));
  }
});

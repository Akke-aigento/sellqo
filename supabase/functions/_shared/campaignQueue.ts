/**
 * MAIL-1a — verzendmotor voor campagnes van winkels.
 *
 * Tot 19 okt 2026 stuurde send-campaign-batch in één request maximaal 50 mails
 * één voor één, zette de campagne daarna op "sent" en boekte fouten van Resend
 * als verzonden. Nu:
 *
 *   1. `enqueueCampaign` legt alle ontvangers één keer vast in `campaign_sends`
 *      (status `queued`, uniek per campagne + adres) en zet de campagne atomair
 *      op `sending`. Dubbel klikken of opnieuw starten mailt niemand twee keer.
 *   2. `processQueue` (worker: edge function process-campaign-queue, gestart door
 *      "Nu verzenden", door zichzelf zolang er werk is, en elke minuut/uur door
 *      cron) start geplande campagnes die aan de beurt zijn, claimt rijen met
 *      SKIP LOCKED en verstuurt ze via de batch-API van Resend (100 per call) met
 *      Idempotency-Key, foutcontrole per mail en retry met backoff.
 *   3. Een campagne gaat pas op `sent` als er niets meer in de wachtrij staat.
 */

// deno-lint-ignore no-explicit-any
type Db = any;

import { tenantMarketingSender } from "./emailSenders.ts";
import { getTenantBrand, renderTenantEmail, type TenantLocale } from "./tenantEmail.ts";
import { t } from "./tenantEmailI18n.ts";
import { extractEmailBody, buildVariableMap, applyVariables, isStandaloneEmailDocument, type VarRecipient, type VarTenant } from "./emailContent.ts";
import { htmlToPlainText } from "./sellqoEmail.ts";
import { resolveAudience } from "./campaignAudience.ts";
import { buildUnsubscribePageUrl, buildUnsubscribeUrl, escapeHtml } from "./marketingToken.ts";
import { htmlSafeVars, mergeAutomationVars, shortLocale } from "./automationVars.ts";
import { loadBillingState } from "./billingGuard.ts";
import { billingAllows } from "./billingState.ts";
import { abDecisionDue, assignVariants, pickAbWinner, planAbTest, subjectForRow, type AbCampaign, type AbPlan } from "./abTest.ts";

export type QueueErrorCode = "PLAN_LIMIT" | "NO_SENDER" | "ALREADY_SENDING" | "NO_RECIPIENTS" | "NOT_FOUND" | "AB_INVALID";

export class CampaignQueueError extends Error {
  constructor(public code: QueueErrorCode, message: string, public status = 400) {
    super(message);
  }
}

/** Kolommen van email_campaigns (met segment) die hier gelezen worden. Andere kolommen: unknown. */
interface CampaignRow extends AbCampaign {
  id: string;
  tenant_id: string;
  status?: string | null;
  subject?: string | null;
  preview_text?: string | null;
  html_content?: string | null;
  language?: string | null;
  preset_key?: string | null;
  translations?: unknown;
  segment?: { filter_rules?: unknown } | null;
  ab_started_at?: string | null;
  ab_winner?: string | null;
  [key: string]: unknown;
}

/** De tenants-kolommen die loadContext ophaalt. */
interface CampaignTenant extends VarTenant {
  language?: string | null;
}

/** Een rij van campaign_sends zoals claim_campaign_sends ze teruggeeft. */
interface SendRow {
  id: string;
  campaign_id: string;
  email: string;
  customer_id?: string | null;
  attempts?: number | null;
  variant?: string | null;
  variables?: unknown;
  [key: string]: unknown;
}

/** Klantvelden voor de variabelen en de opt-in-controle (leeg object als er geen klant is). */
interface CustomerRow extends Partial<VarRecipient> {
  id?: string;
  preferred_language?: string | null;
  email_subscribed?: boolean | null;
  [key: string]: unknown;
}

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH = 100;
const MAX_ATTEMPTS = 5;
const RESEND_SPACING_MS = 600; // standaardlimiet Resend: 2 requests per seconde

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mails zijn verstuurd maar konden niet als verzonden gemarkeerd worden: niet opnieuw in de wachtrij zetten. */
class MarkSentError extends Error {}

// ── Ontvangers en limieten ───────────────────────────────────────────

async function loadCampaign(db: Db, campaignId: string) {
  const { data, error } = await db
    .from("email_campaigns")
    .select("*, segment:customer_segments(*)")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(`campagne lezen mislukt: ${error.message}`);
  if (!data) throw new CampaignQueueError("NOT_FOUND", "Campagne niet gevonden.", 404);
  return data;
}

/** MAIL-2a: systeemcampagnes van automations verstuur of tel je nooit als gewone campagne. */
function assertRegularCampaign(campaign: CampaignRow) {
  if (campaign.kind === "automation") {
    throw new CampaignQueueError("NOT_FOUND", "Dit is een automationmail; die vertrekt vanzelf.", 404);
  }
}

function audienceInputFor(campaign: CampaignRow, tenantLocale: string) {
  const langs = Array.isArray(campaign.available_languages) ? campaign.available_languages : [];
  return {
    tenantId: campaign.tenant_id as string,
    filterRules: (campaign.segment?.filter_rules as Record<string, unknown>) || null,
    presetKey: campaign.preset_key as string | null,
    language: campaign.language as string | null,
    tenantLocale,
    multiLanguage: langs.length > 1,
  };
}

export async function getMarketingQuota(db: Db, tenantId: string) {
  const [{ data: limit, error: e1 }, { data: used, error: e2 }] = await Promise.all([
    db.rpc("marketing_email_limit", { p_tenant_id: tenantId }),
    db.rpc("marketing_emails_used", { p_tenant_id: tenantId }),
  ]);
  if (e1 || e2) throw new Error(`limiet lezen mislukt: ${(e1 || e2).message}`);
  const monthly = typeof limit === "number" ? limit : null;
  const usedN = typeof used === "number" ? used : 0;
  return { monthly, used: usedN, remaining: monthly === null ? null : Math.max(0, monthly - usedN) };
}

/** MAIL-2d: één rij per adres (zoals enqueue_campaign_sends ontdubbelt), zodat de A/B-telling klopt. */
function uniqueByEmail<T extends { email: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = String(r.email || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** MAIL-2d: wat het bevestigingsvenster over de A/B-test toont. */
function abSummary(plan: AbPlan) {
  return {
    requested: plan.reason !== "off",
    enabled: plan.enabled,
    reason: plan.reason === "off" ? null : plan.reason,
    percent: plan.percent,
    wait_hours: plan.waitHours,
    per_variant: plan.perVariant,
    remainder: plan.remainder,
    min_audience: plan.minAudience,
  };
}

/** Telling voor het bevestigingsvenster: ontvangers, verbruik, afzender in orde, A/B-plan. */
export async function countCampaign(db: Db, campaignId: string) {
  const campaign = await loadCampaign(db, campaignId);
  assertRegularCampaign(campaign);
  const brand = await getTenantBrand(db, campaign.tenant_id);
  const recipients = uniqueByEmail(await resolveAudience(db, audienceInputFor(campaign, brand.defaultLocale)));
  const limit = await getMarketingQuota(db, campaign.tenant_id);
  return {
    campaign,
    recipients: recipients.length,
    limit,
    sender_ok: tenantMarketingSender(brand.senderSource) !== null,
    ab: abSummary(planAbTest(campaign, recipients.length)),
  };
}

/**
 * Zet een campagne in de wachtrij. `fromStatuses` bepaalt vanuit welke status
 * dat mag: handmatig vanuit draft/scheduled/failed, de worker enkel vanuit scheduled.
 */
export async function enqueueCampaign(
  db: Db,
  campaignId: string,
  fromStatuses: string[] = ["draft", "scheduled", "failed"],
): Promise<{
  queued: number;
  total_recipients: number;
  ab?: { a: number; b: number; held: number } | null;
  /** MAIL-2d review-fix: onderwerp B ingevuld, maar geen test (bv. doelgroep intussen te klein). */
  ab_skipped?: string | null;
}> {
  const campaign = await loadCampaign(db, campaignId);
  assertRegularCampaign(campaign);
  if (!fromStatuses.includes(campaign.status)) {
    throw new CampaignQueueError("ALREADY_SENDING", "Deze campagne wordt al verstuurd of is al verstuurd.", 409);
  }

  const brand = await getTenantBrand(db, campaign.tenant_id);
  if (!tenantMarketingSender(brand.senderSource)) {
    throw new CampaignQueueError(
      "NO_SENDER",
      "Je winkel heeft nog geen geldig afzenderadres. Stel je mailprefix in bij Instellingen → Email Inbox.",
    );
  }

  const recipients = uniqueByEmail(await resolveAudience(db, audienceInputFor(campaign, brand.defaultLocale)));
  if (!recipients.length) {
    throw new CampaignQueueError("NO_RECIPIENTS", "Er zijn geen ingeschreven ontvangers voor deze campagne.");
  }

  const quota = await getMarketingQuota(db, campaign.tenant_id);
  if (quota.remaining !== null && recipients.length > quota.remaining) {
    throw new CampaignQueueError(
      "PLAN_LIMIT",
      `Deze campagne gaat naar ${recipients.length} ontvangers, maar je plan laat deze maand nog ${quota.remaining} marketingmails toe (${quota.used} van ${quota.monthly} gebruikt). Upgrade je plan of verklein je doelgroep.`,
      402,
    );
  }

  // Atomair in de databank (enqueue_campaign_sends): status, limiet, rijen en de overgang naar
  // 'sending' in één transactie, per winkel na elkaar. De quotacheck hierboven is enkel een
  // vriendelijke vroege melding; de databank beslist.
  const baseRows = recipients.map((r) => ({
    email: r.email,
    customer_id: r.id,
    customer_name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
  }));
  // MAIL-2d: met een onderwerp B en een doelgroep die groot genoeg is, een willekeurige testgroep
  // (A en B) en de rest op "hold". Te klein of meertalig: gewoon onderwerp A naar iedereen (het
  // bevestigingsvenster zegt dat vooraf).
  const abPlan = planAbTest(campaign, baseRows.length);
  const rows = abPlan.enabled ? assignVariants(baseRows, abPlan) : baseRows;
  const { data: res, error: rpcErr } = await db.rpc("enqueue_campaign_sends", {
    p_campaign_id: campaignId,
    p_from_statuses: fromStatuses,
    p_rows: rows,
  });
  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("MAIL_ALREADY_SENDING")) {
      throw new CampaignQueueError("ALREADY_SENDING", "Deze campagne wordt al verstuurd of is al verstuurd.", 409);
    }
    if (msg.includes("MAIL_AB_TOO_SMALL") || msg.includes("MAIL_AB_INVALID")) {
      throw new CampaignQueueError("AB_INVALID", "De A/B-test kon niet starten. Controleer onderwerp B en probeer opnieuw.", 409);
    }
    if (msg.includes("MAIL_NO_RECIPIENTS")) {
      throw new CampaignQueueError("NO_RECIPIENTS", "Er zijn geen (nieuwe) ingeschreven ontvangers voor deze campagne.");
    }
    const m = msg.match(/MAIL_PLAN_LIMIT:(\d+):(\d+)/);
    if (m) {
      const left = Math.max(0, Number(m[1]) - Number(m[2]));
      throw new CampaignQueueError(
        "PLAN_LIMIT",
        `Deze campagne gaat naar ${recipients.length} ontvangers, maar je plan laat deze maand nog ${left} marketingmails toe (${m[2]} van ${m[1]} gebruikt). Upgrade je plan of verklein je doelgroep.`,
        402,
      );
    }
    throw new Error(`in de wachtrij zetten mislukt: ${msg}`);
  }
  const out = res as { queued?: number; ab?: { a: number; b: number; held: number } | null } | null;
  const queued = Number(out?.queued ?? 0);
  const abSkipped = !abPlan.enabled && abPlan.reason !== "off" ? abPlan.reason : null;
  return { queued, total_recipients: queued, ab: abPlan.enabled ? out?.ab ?? null : null, ab_skipped: abSkipped };
}

// ── Worker ───────────────────────────────────────────────────────────

interface CampaignContext {
  campaign: CampaignRow;
  tenant: CampaignTenant;
  brand: Awaited<ReturnType<typeof getTenantBrand>>;
  sender: { from: string; replyTo?: string };
}

async function loadContext(db: Db, campaignId: string): Promise<CampaignContext | null> {
  const campaign = await loadCampaign(db, campaignId);
  const { data: tenant, error } = await db
    .from("tenants")
    .select("name, slug, inbound_email_prefix, support_email, phone, custom_domain, iban, address, city, postal_code, country, language")
    .eq("id", campaign.tenant_id)
    .single();
  if (error || !tenant) throw new Error(`winkel lezen mislukt: ${error?.message ?? "niet gevonden"}`);
  const brand = await getTenantBrand(db, campaign.tenant_id);
  const sender = tenantMarketingSender(brand.senderSource);
  if (!sender) return null;
  return { campaign, tenant, brand, sender };
}

async function renderFor(ctx: CampaignContext, row: SendRow, recipient: CustomerRow) {
  const { campaign, tenant, brand } = ctx;
  const translations: Record<string, { subject?: string; preview_text?: string; html_content?: string }> =
    (campaign.translations as Record<string, { subject?: string; preview_text?: string; html_content?: string }> | null | undefined) || {};
  const available: string[] = Array.isArray(campaign.available_languages) && campaign.available_languages.length
    ? campaign.available_languages
    : ["nl"];
  const runVars = campaign.kind === "automation" && row.variables && typeof row.variables === "object"
    ? (row.variables as Record<string, unknown>)
    : null;
  let locale = ((campaign.language as string) || brand.defaultLocale) as TenantLocale;
  // MAIL-2d: onderwerp B voor de B-groep, en voor de rest als B won. Zonder test: altijd A.
  let subject = campaign.kind === "automation" ? (campaign.subject || "") : subjectForRow(campaign, row.variant);
  let body = campaign.html_content || "";
  if (available.length > 1) {
    // MAIL-2a: bij een automation weegt de taal van de klant zwaarst, daarna de taal van de
    // bestelling/het winkelmandje (variables.locale), dan nl.
    // Review-fix: daarna de standaardtaal van de winkel (kort, bv. "fr-BE" → "fr"), pas dan nl.
    const pref = shortLocale(recipient.preferred_language)
      || (runVars ? shortLocale(runVars.locale) : null)
      || shortLocale(brand.defaultLocale)
      || "nl";
    const chosen = available.includes(pref) ? pref : "nl";
    locale = chosen as TenantLocale;
    const v = translations[chosen];
    if (chosen !== "nl" && v) {
      if (v.subject) subject = v.subject;
      if (v.html_content) body = v.html_content;
    }
  }

  // List-Unsubscribe-header: de functie-URL (RFC 8058 one-click POST). In de tekst van de mail:
  // de afmeldpagina op sellqo.app (MAIL-2a, Resend: links moeten bij het verzenddomein passen).
  const unsubscribeUrl = `${await buildUnsubscribeUrl(campaign.tenant_id, row.email)}&campaign=${campaign.id}`;
  const unsubscribePageUrl = await buildUnsubscribePageUrl(campaign.tenant_id, row.email, {
    campaignId: campaign.id,
    lang: locale,
  });
  const baseVars = buildVariableMap(
    { ...recipient, email: row.email },
    tenant,
    { subject },
    unsubscribePageUrl,
    {
      tenantName: brand.tenantName,
      logoUrl: brand.emailLogoUrl ?? undefined,
      primaryColor: brand.primaryColor,
      accentColor: brand.accentColor,
      headingFont: brand.headingFont,
    },
    locale,
  );
  // Automation: per-mail variabelen (bestelnummer, links, productlijst). Gewone campagne: ongewijzigd.
  const vars = runVars ? mergeAutomationVars(baseVars, runVars) : baseVars;
  // In onderwerp en preheader geen HTML-lijst.
  const textVars = runVars ? { ...vars, cart_items: "" } : vars;
  const renderedSubject = applyVariables(subject, textVars).replace(/[\r\n]+/g, " ").trim();
  // Klantvelden (bv. een voornaam uit het nieuwsbriefformulier) mogen geen HTML in de mail brengen.
  const htmlVars = runVars
    ? htmlSafeVars(vars)
    : Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, escapeHtml(v)])) as typeof vars;
  // MAIL-CLEAN-1: een eigen volledig ontwerp met eigen afmeldlink (de overgenomen welkomstmail)
  // gaat als automationmail ongewijzigd weg, zoals de oude welkomstmail. Gewone campagnes niet.
  if (campaign.kind === "automation" && isStandaloneEmailDocument(body)) {
    const html = applyVariables(body, htmlVars);
    return {
      from: ctx.sender.from,
      reply_to: ctx.sender.replyTo,
      to: [row.email],
      subject: renderedSubject,
      html,
      text: htmlToPlainText(html),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  }
  const intro = applyVariables(extractEmailBody(body), htmlVars);
  const { html, text } = renderTenantEmail({
    tenantBrand: brand,
    locale,
    preheader: campaign.preview_text ? applyVariables(campaign.preview_text, textVars) : renderedSubject,
    heading: renderedSubject,
    intro,
    unsubscribeUrl: unsubscribePageUrl,
    poweredByLabel: t(locale, "campaign.poweredBy"),
  });
  return {
    from: ctx.sender.from,
    reply_to: ctx.sender.replyTo,
    to: [row.email],
    subject: renderedSubject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

async function idempotencyKey(campaignId: string, ids: string[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ids.slice().sort().join(",")));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `campaign-${campaignId}-${hex.slice(0, 32)}`;
}

/** Rijen terug in de wachtrij met backoff, of definitief mislukt na MAX_ATTEMPTS. */
async function retryOrFail(db: Db, rows: Pick<SendRow, "id" | "attempts">[], message: string, delaySeconds: number) {
  const retry = rows.filter((r) => (r.attempts ?? 1) < MAX_ATTEMPTS).map((r) => r.id);
  const fail = rows.filter((r) => (r.attempts ?? 1) >= MAX_ATTEMPTS).map((r) => r.id);
  if (retry.length) {
    await db
      .from("campaign_sends")
      .update({
        status: "queued",
        claimed_at: null,
        error_message: message.slice(0, 500),
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      })
      .in("id", retry);
  }
  if (fail.length) {
    await db
      .from("campaign_sends")
      .update({ status: "failed", claimed_at: null, error_message: message.slice(0, 500) })
      .in("id", fail);
  }
}

async function sendGroup(db: Db, apiKey: string, ctx: CampaignContext | null, rows: SendRow[]) {
  if (!ctx) {
    await db
      .from("campaign_sends")
      .update({ status: "failed", claimed_at: null, error_message: "Geen geldig afzenderadres voor deze winkel." })
      .in("id", rows.map((r) => r.id));
    return { sent: 0, failed: rows.length };
  }

  // Klantgegevens voor de variabelen ({{first_name}} e.a.).
  const customerIds = rows.map((r) => r.customer_id).filter(Boolean);
  // Sleutel mag null/undefined zijn: rijen zonder klant vinden dan gewoon niets.
  const byId = new Map<string | null | undefined, CustomerRow>();
  if (customerIds.length) {
    const { data } = await db
      .from("customers")
      .select("id, email, first_name, last_name, company_name, phone, vat_number, billing_city, billing_country, total_orders, total_spent, tags, created_at, preferred_language, email_subscribed")
      .in("id", customerIds);
    for (const c of data || []) byId.set(c.id, c);
  }

  // Wie zich tussen het inplannen en nu uitschreef, krijgt niets.
  // MAIL-2a: een automationmail op soft opt-in (verlaten winkelwagen, eerdere koper) heeft geen
  // email_subscribed nodig; daar beslist enkel de uitschrijflijst (email_unsubscribes).
  const isSoftOptin = (r: SendRow) =>
    ctx.campaign.kind === "automation" && (r.variables as Record<string, unknown> | null)?._consent === "soft_optin";
  let unsubscribed = new Set<string>();
  if (ctx.campaign.kind === "automation") {
    const { data: un } = await db
      .from("email_unsubscribes")
      .select("email")
      .eq("tenant_id", ctx.campaign.tenant_id)
      .in("email", rows.map((r) => r.email));
    unsubscribed = new Set((un || []).map((u: { email: string }) => String(u.email).trim().toLowerCase()));
    // Review-fix: opt-outs buiten email_unsubscribes (zelfde regel als automation_consent):
    // klantstatus 'unsubscribed' of alle mailvoorkeuren uit. Geldt voor soft opt-in-rijen; een
    // ingeschreven klant (email_subscribed = true) bevestigde opnieuw via double opt-in.
    const softEmails = rows.filter(isSoftOptin).map((r) => String(r.email).trim().toLowerCase());
    if (softEmails.length) {
      const [{ data: optedOut, error: coErr }, { data: prefsOff, error: prErr }] = await Promise.all([
        db.from("customers")
          .select("email")
          .eq("tenant_id", ctx.campaign.tenant_id)
          .eq("email_marketing_status", "unsubscribed")
          .in("email", softEmails),
        db.from("email_preferences")
          .select("email")
          .eq("tenant_id", ctx.campaign.tenant_id)
          .eq("newsletter", false)
          .eq("promotions", false)
          .eq("product_updates", false)
          .in("email", softEmails),
      ]);
      // Twijfel = niet versturen: zonder antwoord gaan deze rijen terug in de wachtrij.
      if (coErr || prErr) throw new Error(`opt-outs lezen mislukt: ${(coErr || prErr)?.message}`);
      for (const u of [...(optedOut || []), ...(prefsOff || [])]) {
        unsubscribed.add(String((u as { email: string }).email).trim().toLowerCase());
      }
    }
  }
  const skip = rows.filter((r) =>
    unsubscribed.has(String(r.email).trim().toLowerCase()) ||
    (r.customer_id && byId.get(r.customer_id)?.email_subscribed === false && !isSoftOptin(r))
  );
  if (skip.length) {
    await db
      .from("campaign_sends")
      .update({ status: "failed", claimed_at: null, error_message: "Intussen uitgeschreven." })
      .in("id", skip.map((r) => r.id));
  }
  const live = rows.filter((r) => !skip.includes(r));
  if (!live.length) return { sent: 0, failed: skip.length };

  const emails = [];
  for (const r of live) emails.push(await renderFor(ctx, r, byId.get(r.customer_id) || {}));

  const res = await fetch(RESEND_BATCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": await idempotencyKey(ctx.campaign.id, live.map((r) => r.id)),
      "x-batch-validation": "permissive",
    },
    body: JSON.stringify(emails),
  });
  const json = await res.json().catch(() => ({}));

  if (res.status === 429) {
    await retryOrFail(db, live, "Resend: te veel verzoeken (429)", 60);
    return { sent: 0, failed: 0, rateLimited: true };
  }
  if (!res.ok) {
    const msg = `Resend ${res.status}: ${json?.message || json?.name || "onbekende fout"}`;
    console.error("[campaignQueue] batch mislukt", { campaign: ctx.campaign.id, status: res.status, msg });
    await retryOrFail(db, live, msg, res.status >= 500 ? 120 : 600);
    return { sent: 0, failed: 0 };
  }

  const data: Array<{ id?: string }> = Array.isArray(json?.data) ? json.data : [];
  const errors: Array<{ index: number; message: string }> = Array.isArray(json?.errors) ? json.errors : [];
  const errorIdx = new Map(errors.map((e) => [e.index, e.message]));

  // In de permissieve modus komen de id's terug voor de geldige mails, in volgorde.
  const okRows: { id: string; resend_id: string }[] = [];
  const badRows: Array<SendRow & { _msg?: string }> = [];
  let d = 0;
  live.forEach((row, i) => {
    if (errorIdx.has(i)) {
      badRows.push({ ...row, _msg: errorIdx.get(i) });
    } else {
      const id = data[d++]?.id;
      if (id) okRows.push({ id: row.id, resend_id: id });
      else badRows.push({ ...row, _msg: "Geen id van Resend ontvangen" });
    }
  });

  if (okRows.length) {
    // Deze mails zijn verstuurd: het markeren mag niet stil mislukken, anders worden ze
    // later opnieuw geclaimd en dubbel verstuurd. Drie pogingen, daarna luid stoppen.
    let markErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await db.rpc("mark_campaign_sends_sent", { p_rows: okRows });
      markErr = error;
      if (!error) break;
      await sleep(500 * (attempt + 1));
    }
    if (markErr) {
      // Laatste poging: rij per rij. Lukt ook dat niet, dan blijven ze op 'sending' en is er een
      // kans op dubbel versturen na 15 minuten; daarom luid in de log.
      for (const r of okRows) {
        await db.from("campaign_sends")
          .update({ status: "sent", resend_id: r.resend_id, sent_at: new Date().toISOString(), claimed_at: null })
          .eq("id", r.id);
      }
      console.error("[campaignQueue] KRITIEK: markeren via RPC mislukt, rij per rij geprobeerd", { campaign: ctx.campaign.id, rows: okRows.length, err: markErr.message });
      throw new MarkSentError(`verzonden mails markeren mislukt: ${markErr.message}`);
    }
  }
  for (const b of badRows) {
    await db
      .from("campaign_sends")
      .update({ status: "failed", claimed_at: null, error_message: String(b._msg).slice(0, 500) })
      .eq("id", b.id);
  }
  return { sent: okRows.length, failed: badRows.length + skip.length };
}

async function refreshCampaignTotals(db: Db, campaignId: string, kind?: string | null) {
  const countOf = async (statuses: string[]) => {
    const { count } = await db
      .from("campaign_sends")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", statuses);
    return count ?? 0;
  };
  // MAIL-2d: rijen die op de winnaar van een A/B-test wachten ("held") zijn nog niet klaar.
  const open = await countOf(["queued", "sending", "held"]);
  const sent = await countOf(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);
  const failed = await countOf(["failed"]);
  const patch: Record<string, unknown> = { total_sent: sent };
  // MAIL-2a: een systeemcampagne van een automation blijft altijd op 'sending' (nooit sent/failed).
  if (kind === undefined) {
    const { data } = await db.from("email_campaigns").select("kind").eq("id", campaignId).maybeSingle();
    kind = data?.kind ?? null;
  }
  if (open === 0 && kind !== "automation") {
    const now = new Date().toISOString();
    patch.status = sent > 0 ? "sent" : "failed";
    patch.sent_at = now;
    patch.completed_at = now;
    patch.send_error = failed > 0 ? `${failed} van ${sent + failed} mails konden niet verstuurd worden.` : null;
  }
  await db.from("email_campaigns").update(patch).eq("id", campaignId).eq("status", "sending");
}

/**
 * MAIL-2d: A/B-tests waarvan de wachttijd voorbij is. Per campagne: cijfers per variant
 * (campaign_ab_stats), winnaar kiezen (klikratio → openratio → A) en de wachtende rijen vrijgeven
 * (campaign_ab_release, één keer per campagne, ook als twee workers tegelijk lopen).
 */
export async function decideAbTests(db: Db, now = new Date()) {
  const { data, error } = await db
    .from("email_campaigns")
    .select("id, tenant_id, ab_started_at, ab_wait_hours")
    .eq("status", "sending")
    .eq("kind", "campaign")
    .is("ab_winner", null)
    .not("ab_started_at", "is", null)
    .limit(50);
  if (error) throw new Error(`A/B-tests lezen mislukt: ${error.message}`);
  const decided: { id: string; winner: string; released: number }[] = [];
  for (const c of data || []) {
    if (!abDecisionDue(c.ab_started_at, c.ab_wait_hours, now)) continue;
    try {
      // Review-fix: zelfde betaalcontrole als bij het starten van een campagne; zonder betaling geen
      // vrijgave (de volgende run probeert opnieuw).
      if (c.tenant_id) {
        const state = await loadBillingState(db, c.tenant_id);
        if (!billingAllows(state, "write", "marketing").allowed) {
          console.warn("[campaignQueue] A/B-rest wacht op betaling", { id: c.id, state: String(state) });
          continue;
        }
      }
      const { data: stats, error: sErr } = await db.rpc("campaign_ab_stats", { p_campaign_id: c.id });
      if (sErr) throw new Error(sErr.message);
      const of = (v: string) => {
        const r = (stats || []).find((x: { variant: string }) => x.variant === v);
        return { sent: Number(r?.sent ?? 0), opened: Number(r?.opened ?? 0), clicked: Number(r?.clicked ?? 0) };
      };
      const winner = pickAbWinner(of("A"), of("B"));
      const { data: rel, error: rErr } = await db.rpc("campaign_ab_release", { p_campaign_id: c.id, p_winner: winner });
      if (rErr) throw new Error(rErr.message);
      if (!rel?.skipped) decided.push({ id: c.id, winner, released: Number(rel?.released ?? 0) });
    } catch (err) {
      console.error("[campaignQueue] A/B-beslissing mislukt (volgende run opnieuw)", { id: c.id, err: String(err) });
    }
  }
  return decided;
}

/**
 * MAIL-2d review-fix: rijen zonder variant van een gestarte A/B-test vragen een winnaar. Staat die
 * niet in de gecachte context, dan de context vers laden; nog steeds geen winnaar → de rijen terug in
 * de wachtrij (+1 min, poging niet meegeteld) en enkel de andere rijen versturen.
 */
async function guardAbRemainder<T extends Record<string, unknown>>(
  db: Db,
  contexts: Map<string, CampaignContext | null>,
  campaignId: string,
  rows: T[],
): Promise<T[]> {
  const ctx = contexts.get(campaignId);
  if (!ctx || !ctx.campaign.ab_started_at || ctx.campaign.ab_winner) return rows;
  const remainder = rows.filter((r) => !r.variant);
  if (!remainder.length) return rows;
  const fresh = await loadContext(db, campaignId);
  contexts.set(campaignId, fresh);
  if (!fresh || fresh.campaign.ab_winner || !fresh.campaign.ab_started_at) return rows;
  const retryAt = new Date(Date.now() + 60_000).toISOString();
  for (const r of remainder) {
    await db.from("campaign_sends")
      .update({ status: "queued", claimed_at: null, next_attempt_at: retryAt, attempts: Math.max(0, Number(r.attempts ?? 1) - 1) })
      .eq("id", r.id)
      .eq("status", "sending");
  }
  console.error("[campaignQueue] A/B-rest zonder winnaar teruggezet", { campaignId, rows: remainder.length });
  return rows.filter((r) => r.variant);
}

/** Eén run van de worker. Geeft `more: true` als er nog werk in de wachtrij staat. */
export async function processQueue(db: Db, opts: { deadlineMs?: number; maxEmails?: number } = {}) {
  const started = Date.now();
  const deadline = started + (opts.deadlineMs ?? 100_000);
  const maxEmails = opts.maxEmails ?? 3000;
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY ontbreekt");

  // 1. Geplande campagnes die aan de beurt zijn.
  const { data: due } = await db
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .eq("kind", "campaign")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(20);
  const started_campaigns: string[] = [];
  for (const c of due || []) {
    try {
      // De betaalcontrole die "Nu verzenden" doet, geldt ook voor ingeplande campagnes.
      const { data: camp } = await db.from("email_campaigns").select("tenant_id").eq("id", c.id).maybeSingle();
      if (camp?.tenant_id) {
        const state = await loadBillingState(db, camp.tenant_id);
        if (!billingAllows(state, "write", "marketing").allowed) {
          throw new Error(`Abonnement ${state}: versturen is pas weer mogelijk na betaling.`);
        }
      }
      await enqueueCampaign(db, c.id, ["scheduled"]);
      started_campaigns.push(c.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[campaignQueue] geplande campagne kon niet starten", { id: c.id, msg });
      if (!(err instanceof CampaignQueueError && err.code === "ALREADY_SENDING")) {
        await db
          .from("email_campaigns")
          .update({ status: "failed", send_error: msg })
          .eq("id", c.id)
          .eq("status", "scheduled");
      }
    }
  }

  // 1b. MAIL-2d: winnaars van A/B-tests kiezen; de rest van die campagnes komt zo in de wachtrij.
  let ab_decided: { id: string; winner: string; released: number }[] = [];
  try {
    ab_decided = await decideAbTests(db);
  } catch (err) {
    console.error("[campaignQueue] A/B-tests overgeslagen", String(err));
  }

  // 2. De wachtrij afwerken.
  const contexts = new Map<string, CampaignContext | null>();
  const touched = new Set<string>();
  let sent = 0;
  let failed = 0;
  let processed = 0;
  let lastCall = 0;
  while (Date.now() < deadline - 15_000 && processed < maxEmails) {
    const { data: claimed, error } = await db.rpc("claim_campaign_sends", { p_limit: BATCH });
    if (error) throw new Error(`wachtrij claimen mislukt: ${error.message}`);
    if (!claimed?.length) break;
    processed += claimed.length;

    const groups = new Map<string, SendRow[]>();
    for (const r of claimed) {
      if (!groups.has(r.campaign_id)) groups.set(r.campaign_id, []);
      groups.get(r.campaign_id)!.push(r);
    }
    let rateLimited = false;
    for (const [campaignId, claimedRows] of groups) {
      touched.add(campaignId);
      let rows = claimedRows;
      if (!contexts.has(campaignId)) {
        try {
          contexts.set(campaignId, await loadContext(db, campaignId));
        } catch (err) {
          console.error("[campaignQueue] context laden mislukt", campaignId, err);
          await retryOrFail(db, rows, err instanceof Error ? err.message : String(err), 300);
          continue;
        }
      }
      // MAIL-2d review-fix: de rest van een A/B-test (variant null) mag nooit met een verouderde
      // context (nog geen winnaar) vertrekken, bv. als een parallelle run de winnaar net koos.
      try {
        rows = await guardAbRemainder(db, contexts, campaignId, rows);
      } catch (err) {
        console.error("[campaignQueue] A/B-context vernieuwen mislukt", campaignId, err);
        await retryOrFail(db, rows, err instanceof Error ? err.message : String(err), 60);
        continue;
      }
      if (!rows.length) continue;
      const wait = RESEND_SPACING_MS - (Date.now() - lastCall);
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      try {
        const r = await sendGroup(db, apiKey, contexts.get(campaignId)!, rows);
        sent += r.sent;
        failed += r.failed;
        if ((r as { rateLimited?: boolean }).rateLimited) rateLimited = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[campaignQueue] groep mislukt", { campaignId, msg });
        if (err instanceof MarkSentError) continue; // verstuurd: nooit opnieuw in de wachtrij
        // Enkel rijen die nog op 'sending' staan (niet die al als verzonden gemarkeerd zijn).
        const { data: still } = await db
          .from("campaign_sends")
          .select("id, attempts")
          .in("id", rows.map((r) => r.id))
          .eq("status", "sending");
        if (still?.length) await retryOrFail(db, still, msg, 300);
      }
    }
    for (const id of touched) await refreshCampaignTotals(db, id);
    if (rateLimited) break;
  }

  // 3. Campagnes afsluiten die klaar zijn (ook die deze run niet aanraakte).
  // Enkel gewone campagnes: systeemcampagnes staan permanent op 'sending' en hun tellers worden
  // bijgewerkt wanneer de worker hun rijen verstuurt.
  const { data: sending } = await db.from("email_campaigns").select("id").eq("status", "sending").eq("kind", "campaign").limit(100);
  for (const c of sending || []) if (!touched.has(c.id)) await refreshCampaignTotals(db, c.id, "campaign");

  const { count: remaining } = await db
    .from("campaign_sends")
    .select("id, email_campaigns!inner(status)", { count: "exact", head: true })
    .eq("status", "queued")
    .eq("email_campaigns.status", "sending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`);

  return { started_campaigns, ab_decided, sent, failed, more: (remaining ?? 0) > 0 };
}

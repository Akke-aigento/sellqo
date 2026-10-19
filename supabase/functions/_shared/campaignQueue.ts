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
import { extractEmailBody, buildVariableMap, applyVariables } from "./emailContent.ts";
import { resolveAudience } from "./campaignAudience.ts";
import { buildUnsubscribePageUrl, buildUnsubscribeUrl, escapeHtml } from "./marketingToken.ts";
import { htmlSafeVars, mergeAutomationVars, shortLocale } from "./automationVars.ts";
import { loadBillingState } from "./billingGuard.ts";
import { billingAllows } from "./billingState.ts";

export type QueueErrorCode = "PLAN_LIMIT" | "NO_SENDER" | "ALREADY_SENDING" | "NO_RECIPIENTS" | "NOT_FOUND";

export class CampaignQueueError extends Error {
  constructor(public code: QueueErrorCode, message: string, public status = 400) {
    super(message);
  }
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertRegularCampaign(campaign: Record<string, any>) {
  if (campaign.kind === "automation") {
    throw new CampaignQueueError("NOT_FOUND", "Dit is een automationmail; die vertrekt vanzelf.", 404);
  }
}

function audienceInputFor(campaign: Record<string, any>, tenantLocale: string) {
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

/** Telling voor het bevestigingsvenster: ontvangers, verbruik, afzender in orde? */
export async function countCampaign(db: Db, campaignId: string) {
  const campaign = await loadCampaign(db, campaignId);
  assertRegularCampaign(campaign);
  const brand = await getTenantBrand(db, campaign.tenant_id);
  const recipients = await resolveAudience(db, audienceInputFor(campaign, brand.defaultLocale));
  const limit = await getMarketingQuota(db, campaign.tenant_id);
  return {
    campaign,
    recipients: recipients.length,
    limit,
    sender_ok: tenantMarketingSender(brand.senderSource) !== null,
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
): Promise<{ queued: number; total_recipients: number }> {
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

  const recipients = await resolveAudience(db, audienceInputFor(campaign, brand.defaultLocale));
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
  const rows = recipients.map((r) => ({
    email: r.email,
    customer_id: r.id,
    customer_name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
  }));
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
  const queued = Number((res as { queued?: number } | null)?.queued ?? 0);
  return { queued, total_recipients: queued };
}

// ── Worker ───────────────────────────────────────────────────────────

interface CampaignContext {
  campaign: Record<string, any>;
  tenant: Record<string, any>;
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

async function renderFor(ctx: CampaignContext, row: Record<string, any>, recipient: Record<string, any>) {
  const { campaign, tenant, brand } = ctx;
  const translations: Record<string, { subject?: string; preview_text?: string; html_content?: string }> =
    (campaign.translations as any) || {};
  const available: string[] = Array.isArray(campaign.available_languages) && campaign.available_languages.length
    ? campaign.available_languages
    : ["nl"];
  const runVars = campaign.kind === "automation" && row.variables && typeof row.variables === "object"
    ? (row.variables as Record<string, unknown>)
    : null;
  let locale = ((campaign.language as string) || brand.defaultLocale) as TenantLocale;
  let subject = campaign.subject || "";
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
      logoUrl: brand.logoUrl,
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
async function retryOrFail(db: Db, rows: Record<string, any>[], message: string, delaySeconds: number) {
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

async function sendGroup(db: Db, apiKey: string, ctx: CampaignContext | null, rows: Record<string, any>[]) {
  if (!ctx) {
    await db
      .from("campaign_sends")
      .update({ status: "failed", claimed_at: null, error_message: "Geen geldig afzenderadres voor deze winkel." })
      .in("id", rows.map((r) => r.id));
    return { sent: 0, failed: rows.length };
  }

  // Klantgegevens voor de variabelen ({{first_name}} e.a.).
  const customerIds = rows.map((r) => r.customer_id).filter(Boolean);
  const byId = new Map<string, Record<string, any>>();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSoftOptin = (r: Record<string, any>) =>
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
  const badRows: Record<string, any>[] = [];
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
  const open = await countOf(["queued", "sending"]);
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

    const groups = new Map<string, Record<string, any>[]>();
    for (const r of claimed) {
      if (!groups.has(r.campaign_id)) groups.set(r.campaign_id, []);
      groups.get(r.campaign_id)!.push(r);
    }
    let rateLimited = false;
    for (const [campaignId, rows] of groups) {
      touched.add(campaignId);
      if (!contexts.has(campaignId)) {
        try {
          contexts.set(campaignId, await loadContext(db, campaignId));
        } catch (err) {
          console.error("[campaignQueue] context laden mislukt", campaignId, err);
          await retryOrFail(db, rows, err instanceof Error ? err.message : String(err), 300);
          continue;
        }
      }
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

  return { started_campaigns, sent, failed, more: (remaining ?? 0) > 0 };
}

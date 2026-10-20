/**
 * MAIL-2a — de motor van de e-mailautomations.
 *
 * Eén run van de engine (edge function automation-scheduler, elke minuut door cron):
 *   1. `automation_scan_triggers` zoekt nieuwe win-back-klanten (eens per ~20 u per winkel) en
 *      verlaten winkelwagens (elke 5 min) en plant runs in. Bestelling betaald en nieuwsbrief
 *      bevestigd plannen zichzelf in (trigger op orders, newsletter-confirm).
 *   2. Runs die aan de beurt zijn worden geclaimd (SKIP LOCKED). Per run: opnieuw controleren
 *      (automation nog aan, bestelling nog betaald, winkelwagen nog niet besteld, reviewlink),
 *      de variabelen opbouwen en de mail via `enqueue_automation_send` in campaign_sends zetten.
 *      Toestemming, uitschrijflijst en maandlimiet beslist de databank.
 *   3. De run gaat naar de volgende stap (`automation_finish_step`) of stopt.
 *   4. Staat er iets in de wachtrij, dan start de campagneworker (process-campaign-queue) meteen.
 *
 * De worker verstuurt automationmails zoals campagnes (huisstijl, afzender, afmeldlink, retry).
 */

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

import { getTenantBrand } from "./tenantEmail.ts";
import { tenantMarketingSender } from "./emailSenders.ts";
import { resolveShopUrl } from "./mailPages.ts";
import { loadStorefrontUrlContext, productUrlFor, type StorefrontUrlContext } from "./storefrontUrls.ts";
import { cartUrlForReminder } from "./cartRestoreToken.ts";
import { loadBillingState } from "./billingGuard.ts";
import { billingAllows } from "./billingState.ts";
import {
  buildCartItemsHtml,
  type CartLine,
  firstNameOf,
  mapEnqueueError,
  ORDER_PAID_STATUSES,
  pickReviewUrl,
  retryDelayMinutes,
  shortLocale,
} from "./automationVars.ts";

const MAX_ATTEMPTS = 4;
/** Hooguit één reviewvraag per ontvanger per winkel binnen deze termijn (MAIL-2a review-fix). */
const REVIEW_COOLDOWN_DAYS = 30;

interface TenantCtx {
  shopUrl: string;
  senderOk: boolean;
  billingOk: boolean;
  billingState: string;
  reviewUrl: string | null | undefined; // undefined = nog niet opgehaald
  /** MAIL-2c: voor productlinks in {{cart_items}}; undefined = nog niet opgehaald. */
  storefront?: StorefrontUrlContext;
}

interface StepInfo {
  id: string;
  automation_id: string;
  step_order: number;
  is_active: boolean | null;
}

/** Is dit de reviewstap? Stap 2 van "na aankoop", of elke stap die {{review_url}} gebruikt. */
export function stepNeedsReviewUrl(
  presetKey: string | null | undefined,
  stepOrder: number,
  campaign: { subject?: string | null; html_content?: string | null; preview_text?: string | null; translations?: unknown } | null,
): boolean {
  if (presetKey === "post_purchase" && stepOrder === 2) return true;
  if (!campaign) return false;
  const blob = [campaign.subject, campaign.html_content, campaign.preview_text, JSON.stringify(campaign.translations ?? {})]
    .join(" ");
  return /\{\{\s*review_url\s*\}\}/.test(blob);
}

async function tenantCtx(db: Db, cache: Map<string, TenantCtx>, tenantId: string): Promise<TenantCtx> {
  const hit = cache.get(tenantId);
  if (hit) return hit;
  const brand = await getTenantBrand(db, tenantId);
  const shopUrl = await resolveShopUrl(db, tenantId, brand);
  const state = await loadBillingState(db, tenantId);
  const ctx: TenantCtx = {
    shopUrl,
    senderOk: tenantMarketingSender(brand.senderSource) !== null,
    billingOk: billingAllows(state, "write", "marketing").allowed,
    billingState: String(state),
    reviewUrl: undefined,
  };
  cache.set(tenantId, ctx);
  return ctx;
}

async function reviewUrlFor(db: Db, ctx: TenantCtx, tenantId: string): Promise<string | null> {
  if (ctx.reviewUrl !== undefined) return ctx.reviewUrl;
  const { data, error } = await db
    .from("review_platform_connections")
    .select("platform, is_enabled, external_url, external_id")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`reviewkoppeling lezen mislukt: ${error.message}`);
  ctx.reviewUrl = pickReviewUrl(data || []);
  return ctx.reviewUrl;
}

/** MAIL-2c: productlinks van de winkel, één keer per run en winkel. */
async function storefrontFor(db: Db, ctx: TenantCtx, tenantId: string): Promise<StorefrontUrlContext> {
  if (!ctx.storefront) ctx.storefront = await loadStorefrontUrlContext(db, tenantId);
  return ctx.storefront;
}

async function cartLines(db: Db, cartId: string, storefront: StorefrontUrlContext): Promise<CartLine[]> {
  const { data: items, error } = await db
    .from("storefront_cart_items")
    .select("product_id, variant_id, quantity")
    .eq("cart_id", cartId)
    .order("created_at")
    .limit(10);
  if (error) throw new Error(`winkelwagen lezen mislukt: ${error.message}`);
  if (!items?.length) return [];
  const productIds = [...new Set(items.map((i: { product_id: string }) => i.product_id).filter(Boolean))];
  const variantIds = [...new Set(items.map((i: { variant_id: string }) => i.variant_id).filter(Boolean))];
  const names = new Map<string, string>();
  const slugs = new Map<string, string>();
  const variants = new Map<string, string>();
  if (productIds.length) {
    const { data } = await db.from("products").select("id, name, slug").in("id", productIds);
    for (const p of data || []) {
      names.set(p.id, p.name);
      if (p.slug) slugs.set(p.id, p.slug);
    }
  }
  if (variantIds.length) {
    const { data } = await db.from("product_variants").select("id, title").in("id", variantIds);
    for (const v of data || []) variants.set(v.id, v.title);
  }
  return items.map((i: { product_id: string; variant_id: string | null; quantity: number }) => ({
    quantity: i.quantity,
    product_name: names.get(i.product_id) ?? null,
    variant_title: i.variant_id ? variants.get(i.variant_id) ?? null : null,
    product_url: productUrlFor(storefront, slugs.get(i.product_id)),
  }));
}

async function finish(db: Db, runId: string, outcome: string, message?: string | null) {
  const { error } = await db.rpc("automation_finish_step", {
    p_run_id: runId,
    p_outcome: outcome,
    p_message: message ?? null,
  });
  if (error) throw new Error(`run afronden mislukt: ${error.message}`);
}

/** Onverwachte fout: later opnieuw proberen, na MAX_ATTEMPTS stoppen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function retryLater(db: Db, run: Record<string, any>, message: string) {
  if ((run.attempts ?? 1) >= MAX_ATTEMPTS) {
    await finish(db, run.id, "failed", message.slice(0, 500));
    return;
  }
  const at = new Date(Date.now() + retryDelayMinutes(run.attempts ?? 1) * 60_000).toISOString();
  const { error } = await db
    .from("automation_runs")
    .update({ status: "scheduled", scheduled_for: at, claimed_at: null, error_message: message.slice(0, 500) })
    .eq("id", run.id)
    .eq("status", "running");
  if (error) console.error("[automationEngine] run terugzetten mislukt", run.id, error.message);
}

/** Eén melding per winkel per dag als de maandlimiet een automationmail tegenhoudt. */
async function notifyPlanLimit(db: Db, tenantId: string, limit: number, used: number) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("type", "automation_plan_limit")
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  const { error } = await db.rpc("send_notification", {
    p_tenant_id: tenantId,
    p_category: "marketing",
    p_type: "automation_plan_limit",
    p_title: "Automatische mails gepauzeerd: limiet bereikt",
    p_message: `Je plan laat deze maand ${limit} marketingmails toe en die zijn op (${used} gebruikt). Automatische mails worden overgeslagen tot volgende maand of tot je je plan verhoogt.`,
    p_priority: "high",
    p_action_url: "/admin/marketing/automations",
    p_metadata: { limit, used },
  });
  if (error) console.error("[automationEngine] melding limiet mislukt", tenantId, error.message);
}

type RunResult = "queued" | "next" | "cancelled" | "skipped" | "retry" | "stale";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processRun(db: Db, run: Record<string, any>, cache: Map<string, TenantCtx>): Promise<RunResult> {
  const { data: auto, error: aErr } = await db
    .from("email_automations")
    .select("id, tenant_id, is_active, preset_key, trigger_type")
    .eq("id", run.automation_id)
    .maybeSingle();
  if (aErr) throw new Error(`automation lezen mislukt: ${aErr.message}`);
  if (!auto || !auto.is_active) {
    await finish(db, run.id, "cancelled", "Automation staat uit.");
    return "cancelled";
  }

  const { data: step, error: sErr } = await db
    .from("automation_steps")
    .select("id, automation_id, step_order, is_active")
    .eq("id", run.next_step_id)
    .maybeSingle();
  if (sErr) throw new Error(`stap lezen mislukt: ${sErr.message}`);
  if (!step) {
    await finish(db, run.id, "cancelled", "Stap bestaat niet meer.");
    return "cancelled";
  }
  if ((step as StepInfo).is_active === false) {
    await finish(db, run.id, "next", "Stap uitgeschakeld, overgeslagen.");
    return "next";
  }

  const { data: campaign, error: cErr } = await db
    .from("email_campaigns")
    .select("id, subject, html_content, preview_text, translations, kind")
    .eq("automation_step_id", step.id)
    .maybeSingle();
  if (cErr) throw new Error(`systeemcampagne lezen mislukt: ${cErr.message}`);
  if (!campaign || campaign.kind !== "automation") {
    await finish(db, run.id, "next", "Geen mail voor deze stap.");
    return "next";
  }

  const tctx = await tenantCtx(db, cache, run.tenant_id);
  if (!tctx.billingOk) {
    await finish(db, run.id, "skipped", `Abonnement ${tctx.billingState}: automatische mails gepauzeerd.`);
    return "skipped";
  }
  if (!tctx.senderOk) {
    await finish(db, run.id, "skipped", "Geen geldig afzenderadres voor deze winkel.");
    return "skipped";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (run.metadata && typeof run.metadata === "object" ? run.metadata : {}) as Record<string, any>;
  // Altijd vijf variabelen (beslissing 19-10); leeg als er geen waarde is.
  const vars: Record<string, string> = {
    order_number: "",
    shop_url: tctx.shopUrl || "",
    review_url: "",
    cart_url: "",
    cart_items: "",
  };
  let locale = shortLocale(meta.locale);
  let firstName = "";

  if (run.trigger_entity_type === "order" && run.trigger_entity_id) {
    const { data: order, error } = await db
      .from("orders")
      .select("id, order_number, status, payment_status, customer_name, locale")
      .eq("id", run.trigger_entity_id)
      .maybeSingle();
    if (error) throw new Error(`bestelling lezen mislukt: ${error.message}`);
    if (!order || !ORDER_PAID_STATUSES.includes(String(order.payment_status)) || order.status === "cancelled") {
      await finish(db, run.id, "cancelled", "Bestelling niet meer betaald of geannuleerd.");
      return "cancelled";
    }
    vars.order_number = String(order.order_number ?? "");
    locale = locale || shortLocale(order.locale);
    firstName = firstNameOf(order.customer_name);
  }

  if (run.trigger_entity_type === "cart" && run.trigger_entity_id) {
    const { data: cart, error } = await db
      .from("storefront_carts")
      .select("id, tenant_id, created_at, expires_at, customer_first_name, locale, checkout_status")
      .eq("id", run.trigger_entity_id)
      .maybeSingle();
    if (error) throw new Error(`winkelwagen lezen mislukt: ${error.message}`);
    if (!cart || cart.checkout_status === "converted") {
      await finish(db, run.id, "cancelled", "Winkelwagen besteld of verdwenen.");
      return "cancelled";
    }
    // Intussen besteld (welke betaalstatus ook, behalve geannuleerd)? Dan geen herinnering.
    const { count, error: oErr } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", run.tenant_id)
      .ilike("customer_email", String(run.recipient_email).replace(/[\\%_]/g, (c: string) => `\\${c}`))
      .gte("created_at", cart.created_at)
      .neq("status", "cancelled");
    if (oErr) throw new Error(`bestellingen lezen mislukt: ${oErr.message}`);
    if ((count ?? 0) > 0) {
      await finish(db, run.id, "cancelled", "Intussen besteld.");
      return "cancelled";
    }
    const storefront = await storefrontFor(db, tctx, run.tenant_id);
    // MAIL-3: SellQo-winkel → ondertekende herstel-link (nieuw mandje met de producten, nooit het
    // oude cart_id). Custom frontend of geen online winkel → de winkel zelf, zoals voorheen.
    try {
      vars.cart_url = await cartUrlForReminder({
        storefront, shopUrl: tctx.shopUrl, tenantId: run.tenant_id, runId: run.id, cartExpiresAt: cart.expires_at,
      });
    } catch (err) {
      console.error("[automationEngine] herstel-link maken mislukt, link naar de winkel", run.id, err instanceof Error ? err.message : err);
      vars.cart_url = tctx.shopUrl || "";
    }
    vars.cart_items = buildCartItemsHtml(await cartLines(db, cart.id, storefront));
    locale = locale || shortLocale(cart.locale);
    firstName = String(cart.customer_first_name || "").trim();
  }

  if (stepNeedsReviewUrl(auto.preset_key, step.step_order, campaign)) {
    const url = await reviewUrlFor(db, tctx, run.tenant_id);
    if (!url) {
      await finish(db, run.id, "next", "Geen reviewprofiel gekoppeld: reviewmail overgeslagen.");
      return "next";
    }
    // Review-fix: hooguit één reviewvraag per ontvanger per winkel per 30 dagen (vaste klant met
    // meerdere bestellingen). Herkend aan een gevulde review_url in de verzendrij.
    const since = new Date(Date.now() - REVIEW_COOLDOWN_DAYS * 86_400_000).toISOString();
    const { count: recent, error: rErr } = await db
      .from("campaign_sends")
      .select("id, email_campaigns!inner(tenant_id)", { count: "exact", head: true })
      .eq("email_campaigns.tenant_id", run.tenant_id)
      .eq("email", String(run.recipient_email).trim().toLowerCase())
      .not("automation_run_id", "is", null)
      .neq("automation_run_id", run.id)
      .neq("variables->>review_url", "")
      .neq("status", "failed")
      .gte("created_at", since);
    if (rErr) throw new Error(`eerdere reviewvragen lezen mislukt: ${rErr.message}`);
    if ((recent ?? 0) > 0) {
      await finish(db, run.id, "skipped", `Reviewvraag overgeslagen: deze klant kreeg er al een in de laatste ${REVIEW_COOLDOWN_DAYS} dagen.`);
      return "skipped";
    }
    vars.review_url = url;
  }

  if (!firstName && typeof meta.first_name === "string") firstName = meta.first_name.trim();
  const variables: Record<string, string> = { ...vars };
  if (locale) variables.locale = locale;
  if (firstName) variables.customer_first_name = firstName;

  const { error: qErr } = await db.rpc("enqueue_automation_send", {
    p_run_id: run.id,
    p_step_id: step.id,
    p_email: run.recipient_email,
    p_customer_id: run.customer_id ?? null,
    p_campaign_id: campaign.id,
    p_variables: variables,
  });
  if (qErr) {
    const outcome = mapEnqueueError(qErr.message || "");
    switch (outcome.kind) {
      case "plan_limit":
        await finish(db, run.id, "skipped", `Maandlimiet bereikt (${outcome.used} van ${outcome.limit}).`);
        await notifyPlanLimit(db, run.tenant_id, outcome.limit, outcome.used);
        return "skipped";
      case "cancelled":
        await finish(db, run.id, "cancelled", outcome.message);
        return "cancelled";
      case "stale":
        // Een andere engine-run heeft deze run al verder gezet; niets doen.
        return "stale";
      default:
        await retryLater(db, run, outcome.message);
        return "retry";
    }
  }
  await finish(db, run.id, "next");
  return "queued";
}

/** Eén run van de engine. */
export async function runAutomationEngine(
  db: Db,
  opts: { deadlineMs?: number; batch?: number } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const started = Date.now();
  const deadline = started + (opts.deadlineMs ?? 100_000);
  const batch = opts.batch ?? 50;

  let scan: unknown = null;
  const { data: scanRes, error: scanErr } = await db.rpc("automation_scan_triggers");
  if (scanErr) console.error("[automationEngine] scan mislukt", scanErr.message);
  else scan = scanRes;

  const cache = new Map<string, TenantCtx>();
  const counts: Record<RunResult | "error", number> = {
    queued: 0, next: 0, cancelled: 0, skipped: 0, retry: 0, stale: 0, error: 0,
  };
  while (Date.now() < deadline - 15_000) {
    const { data: runs, error } = await db.rpc("claim_automation_runs", { p_limit: batch });
    if (error) throw new Error(`runs claimen mislukt: ${error.message}`);
    if (!runs?.length) break;
    for (const run of runs) {
      try {
        counts[await processRun(db, run, cache)]++;
      } catch (err) {
        counts.error++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[automationEngine] run mislukt", { run: run.id, msg });
        await retryLater(db, run, msg).catch((e) => console.error("[automationEngine] retry mislukt", e));
      }
    }
    if (runs.length < batch) break;
  }

  return { scan, ...counts, ms: Date.now() - started };
}

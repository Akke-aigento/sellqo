// MAIL-1b (19-10-2026) — voorbeeld van een campagne in de echte huisstijl.
//
// Rendert exact zoals de verzending (_shared/campaignQueue.ts renderFor): brand
// van de winkel, variabelen met voorbeeldgegevens (HTML-escaped), renderTenantEmail.
// Verstuurt niets en schrijft niets. De uitschrijflink is een dummy ("#"), zodat
// een klik in het voorbeeld nooit iemand uitschrijft.
//
// Body: { tenant_id, subject, html_content, preview_text?, language?, kind? } → { html, subject }
// kind = 'automation' (MAIL-CLEAN-1): een eigen volledig ontwerp met eigen afmeldlink ongewijzigd.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateRequest, requireRole, AuthError, authErrorResponse, type AppRole } from "../_shared/auth.ts";
import { getTenantBrand, renderTenantEmail, type TenantLocale } from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";
import { extractEmailBody, buildVariableMap, applyVariables, isStandaloneEmailDocument } from "../_shared/emailContent.ts";
import { buildCartItemsHtml, htmlSafeVars, mergeAutomationVars } from "../_shared/automationVars.ts";
import { resolveShopUrl } from "../_shared/mailPages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES: AppRole[] = ["tenant_admin", "staff", "marketing", "viewer"];
const MAX_HTML = 500_000; // tekens, ±500 KB
const MAX_SUBJECT = 500;
const MAX_PREVIEW_TEXT = 500;
// Enkel de kolommen die buildVariableMap (+ resolveCustomerContactEmail) leest.
// iban blijft: {{company_iban}} is een campagnevariabele en het voorbeeld moet
// exact tonen wat de verzending toont.
const TENANT_COLUMNS =
  "name, slug, inbound_email_prefix, support_email, phone, custom_domain, iban, address, city, postal_code, country";
const LOCALES: TenantLocale[] = ["nl", "en", "fr", "de"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : "";
    if (!tenantId) return json({ error: "tenant_id is required" }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ROLES);

    const subject = String(body?.subject ?? "");
    const htmlContent = String(body?.html_content ?? "");
    if (htmlContent.length > MAX_HTML) return json({ error: "Inhoud te groot (max. 500 KB)" }, 413);
    if (subject.length > MAX_SUBJECT) return json({ error: `Onderwerp te lang (max. ${MAX_SUBJECT} tekens)` }, 413);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tenant } = await db
      .from("tenants")
      .select(TENANT_COLUMNS)
      .eq("id", tenantId)
      .maybeSingle();
    const brand = await getTenantBrand(db, tenantId);

    const reqLang = String(body?.language || "").toLowerCase().slice(0, 2) as TenantLocale;
    const locale: TenantLocale = LOCALES.includes(reqLang) ? reqLang : (brand.defaultLocale as TenantLocale);

    const unsubscribeUrl = "#";
    const baseVars = buildVariableMap(
      { email: "jan.peeters@voorbeeld.be", first_name: "Jan", last_name: "Peeters" },
      tenant,
      { subject },
      unsubscribeUrl,
      {
        tenantName: brand.tenantName,
        logoUrl: brand.emailLogoUrl ?? undefined,
        primaryColor: brand.primaryColor,
        accentColor: brand.accentColor,
        headingFont: brand.headingFont,
      },
      locale,
    );
    // MAIL-2a: voorbeeldwaarden voor de automationvariabelen. Een gewone campagne gebruikt die
    // tokens niet, dus haar voorbeeld blijft gelijk; in een automationmail zie je realistische tekst.
    const shopUrl = await resolveShopUrl(db, tenantId, brand);
    const vars = mergeAutomationVars(baseVars, {
      order_number: "#1001",
      shop_url: shopUrl,
      cart_url: shopUrl,
      review_url: shopUrl,
      cart_items: buildCartItemsHtml([{ quantity: 1, product_name: "Voorbeeldproduct" }]),
      current_year: String(new Date().getFullYear()),
    });
    const textVars = { ...vars, cart_items: "" };
    const renderedSubject = applyVariables(subject, textVars);
    const htmlVars = htmlSafeVars(vars);
    // MAIL-CLEAN-1: zelfde regel als de verzending (campaignQueue renderFor): een eigen volledig
    // ontwerp met eigen afmeldlink toont een automationstap ongewijzigd.
    if (body?.kind === "automation" && isStandaloneEmailDocument(htmlContent)) {
      return json({ html: applyVariables(htmlContent, htmlVars), subject: renderedSubject });
    }
    const intro = applyVariables(extractEmailBody(htmlContent), htmlVars);
    const previewText = typeof body?.preview_text === "string" && body.preview_text
      ? body.preview_text.slice(0, MAX_PREVIEW_TEXT)
      : "";
    const { html } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: previewText ? applyVariables(previewText, textVars) : renderedSubject,
      heading: renderedSubject,
      intro,
      unsubscribeUrl,
      poweredByLabel: t(locale, "campaign.poweredBy"),
    });

    return json({ html, subject: renderedSubject });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("[render-campaign-preview]", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

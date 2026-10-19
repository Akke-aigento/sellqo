import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getTenantBrand, type TenantBrand } from "../_shared/tenantEmail.ts";
import { tenantMarketingSender, tenantSender } from "../_shared/emailSenders.ts";
import { buildUnsubscribeUrl, escapeHtml } from "../_shared/marketingToken.ts";
import { redirectToApp, resolveShopUrl, shopLogo } from "../_shared/mailPages.ts";

// MAIL-1a (19 okt 2026): double opt-in staat aan voor alle winkels.
// storefront-api zet een inschrijving op `pending` en mailt een link naar deze
// functie (?token=<confirmation_token>&tenant=<tenantId>). Hier wordt de
// inschrijving pas actief, krijgt de klant `email_subscribed = true` en vertrekt
// de welkomstmail. Idempotent: een tweede klik verstuurt niets opnieuw.
//
// MAIL-1c: geen HTML meer (Supabase serveert die als text/plain, klanten zagen de
// broncode). Na de bevestiging volgt een 302 naar sellqo.app/mail/bevestigd met
// status, winkelnaam, shop-URL, logo en taal; die pagina doet geen servercall.

type Locale = "nl" | "en" | "fr" | "de";

const pickLocale = (v: unknown, fallback: Locale = "nl"): Locale => {
  const s = String(v || "").toLowerCase().slice(0, 2);
  return (["nl", "en", "fr", "de"] as const).includes(s as Locale) ? (s as Locale) : fallback;
};

type ConfirmStatus = "ok" | "already" | "invalid" | "unsubscribed" | "error";

/** 302 naar de resultaatpagina. Enkel publieke winkelgegevens in de URL. */
function resultRedirect(status: ConfirmStatus, locale: Locale, brand: TenantBrand | null, shopUrl: string): Response {
  return redirectToApp("/mail/bevestigd", {
    status,
    lang: locale,
    shop: brand?.tenantName || null,
    url: /^https?:\/\//i.test(shopUrl) ? shopUrl : null,
    logo: brand ? shopLogo(brand) : null,
  });
}

/** Escape voor ILIKE, zodat `_` en `%` in een adres geen jokers zijn. */
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Klant markeren als ingeschreven. Zelfde gedrag als storefront-api vóór MAIL-1a
 * bij inschrijving: bestaande klant bijwerken (+ tag 'subscribed'), anders een
 * prospect aanmaken.
 */
async function markCustomerSubscribed(
  supabase: any,
  tenantId: string,
  email: string,
  firstName: string | null,
  language: string | undefined,
) {
  try {
    const now = new Date().toISOString();
    // Wie bevestigt, schreef zich opnieuw in: een eerdere uitschrijving of klacht vervalt.
    // Een harde bounce blijft staan (dat adres bestaat niet). Anders sloot de doelgroep
    // (campaignAudience.ts) dit adres voor altijd uit.
    const { error: unErr } = await supabase
      .from("email_unsubscribes")
      .delete()
      .eq("tenant_id", tenantId)
      .ilike("email", escapeLike(email))
      .or("reason.is.null,reason.neq.bounce");
    if (unErr) console.error("[NIEUWSBRIEF-BEVESTIG] uitschrijving wissen mislukt:", unErr.message);
    const { data: existing } = await supabase
      .from("customers")
      .select("id, tags, preferred_language")
      .eq("tenant_id", tenantId)
      .ilike("email", escapeLike(email))
      .limit(1)
      .maybeSingle();

    if (existing) {
      const tags: string[] = existing.tags || [];
      const updates: Record<string, unknown> = { email_subscribed: true, email_subscribed_at: now };
      if (!tags.includes("subscribed")) updates.tags = [...tags, "subscribed"];
      if (language && !existing.preferred_language) updates.preferred_language = language;
      const { error } = await supabase.from("customers").update(updates).eq("id", existing.id);
      if (error) console.error("[NIEUWSBRIEF-BEVESTIG] klant bijwerken mislukt:", error.message);
    } else {
      const { error } = await supabase.from("customers").insert({
        tenant_id: tenantId,
        email,
        first_name: firstName || null,
        customer_type: "prospect",
        tags: ["subscribed"],
        email_subscribed: true,
        email_subscribed_at: now,
        preferred_language: language || null,
        acquisition_source: "webshop",
      });
      if (error) console.error("[NIEUWSBRIEF-BEVESTIG] prospect aanmaken mislukt:", error.message);
    }
  } catch (e) {
    console.error("[NIEUWSBRIEF-BEVESTIG] klant-upsert fout:", e);
  }
}

/** Welkomstmail (marketing). Zelfde logica als storefront-api bij single opt-in. */
async function sendWelcomeEmail(
  supabase: any,
  tenantId: string,
  email: string,
  firstName: string | null,
  config: any,
  brand: TenantBrand,
  shopUrl: string,
) {
  if (!config?.welcome_email_enabled || !config?.welcome_email_body) return;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("[WELKOMSTMAIL] RESEND_API_KEY ontbreekt, overgeslagen");
    return;
  }
  try {
    const unsubscribeUrl = await buildUnsubscribeUrl(tenantId, email);
    const values: Record<string, string> = {
      "{{customer_first_name}}": firstName || "",
      "{{customer_name}}": firstName || "",
      "{{first_name}}": firstName || "",
      "{{customer_email}}": email,
      "{{company_name}}": brand.tenantName,
      "{{company_website}}": shopUrl,
      "{{SHOP_URL}}": shopUrl,
      "{{unsubscribe_url}}": unsubscribeUrl,
      "{{AFMELD_URL}}": unsubscribeUrl,
      "{{LOGO_URL}}": brand.logoUrl,
      "{{JAAR}}": String(new Date().getFullYear()),
    };
    let body = String(config.welcome_email_body);
    let subject = String(config.welcome_email_subject || "Welkom bij onze nieuwsbrief!");
    for (const [key, value] of Object.entries(values)) {
      body = body.split(key).join(escapeHtml(value));
      subject = subject.split(key).join(value);
    }
    subject = subject.replace(/[\r\n]+/g, " ").trim();

    const sender = tenantMarketingSender(brand.senderSource) ?? tenantSender(brand.senderSource);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender.from,
        reply_to: sender.replyTo,
        to: [email],
        subject,
        html: body,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      console.error("[WELKOMSTMAIL] Resend weigerde:", res.status, await res.text());
    } else {
      console.log("[WELKOMSTMAIL] verstuurd na bevestiging | tenant:", tenantId);
    }
  } catch (e) {
    console.error("[WELKOMSTMAIL] verzendfout:", e);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const token = url.searchParams.get("token");
  const tenantId = url.searchParams.get("tenant");
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!token || !tenantId || !uuidRe.test(token) || !uuidRe.test(tenantId)) {
    return resultRedirect("invalid", pickLocale(url.searchParams.get("lang")), null, "");
  }

  let brand: TenantBrand | null = null;
  let locale: Locale = "nl";
  let shopUrl = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    brand = await getTenantBrand(supabase, tenantId);
    shopUrl = await resolveShopUrl(supabase, tenantId, brand);

    const { data: subscriber, error } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, first_name, status, confirmed_at, metadata")
      .eq("confirmation_token", token)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const subLang = subscriber?.metadata && typeof subscriber.metadata === "object"
      ? (subscriber.metadata as Record<string, unknown>).language
      : undefined;
    locale = pickLocale(subLang, brand.defaultLocale);

    if (error || !subscriber) {
      return resultRedirect("invalid", locale, brand, shopUrl);
    }

    if (subscriber.status === "active") {
      return resultRedirect("already", locale, brand, shopUrl);
    }

    // Alleen een openstaande inschrijving mag bevestigd worden. Wie zich
    // uitschreef, wordt niet heringeschreven door een oude bevestigingslink.
    if (subscriber.status && subscriber.status !== "pending") {
      return resultRedirect(subscriber.status === "unsubscribed" ? "unsubscribed" : "invalid", locale, brand, shopUrl);
    }

    // Atomair: alleen de aanroep die de rij écht van pending naar active zet,
    // gaat verder. Twee klikken tegelijk geven dus maar één welkomstmail.
    const { data: flipped, error: flipErr } = await supabase
      .from("newsletter_subscribers")
      .update({ status: "active", confirmed_at: new Date().toISOString(), unsubscribed_at: null })
      .eq("id", subscriber.id)
      .or("status.is.null,status.eq.pending")
      .select("id");

    if (flipErr) throw flipErr;
    if (!flipped || flipped.length === 0) {
      return resultRedirect("already", locale, brand, shopUrl);
    }

    const email = String(subscriber.email).trim().toLowerCase();
    const language = typeof subLang === "string" ? pickLocale(subLang) : undefined;

    await markCustomerSubscribed(supabase, tenantId, email, subscriber.first_name, language);

    // Voorkeuren aanmaken/bijwerken
    await supabase
      .from("email_preferences")
      .upsert({
        tenant_id: tenantId,
        email,
        newsletter: true,
        promotions: true,
        product_updates: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,email" });

    const { data: config } = await supabase
      .from("tenant_newsletter_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // Externe provider: synchroniseren (ongewijzigd t.o.v. vóór MAIL-1a).
    if (config?.provider === "mailchimp" && config.mailchimp_api_key) {
      try {
        const serverPrefix = config.mailchimp_server_prefix || config.mailchimp_api_key.split("-").pop();
        const response = await fetch(
          `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${config.mailchimp_audience_id}/members`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`anystring:${config.mailchimp_api_key}`)}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email_address: email,
              status: "subscribed",
              merge_fields: { FNAME: subscriber.first_name || "" },
            }),
          },
        );
        if (response.ok) {
          const data = await response.json();
          await supabase
            .from("newsletter_subscribers")
            .update({ sync_status: "synced", external_id: data.id })
            .eq("id", subscriber.id);
        }
      } catch (syncError) {
        console.error("Mailchimp sync fout:", syncError);
      }
    } else if (config?.provider === "klaviyo" && config.klaviyo_api_key) {
      try {
        const response = await fetch(
          "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/",
          {
            method: "POST",
            headers: {
              "Authorization": `Klaviyo-API-Key ${config.klaviyo_api_key}`,
              "Content-Type": "application/json",
              "revision": "2023-02-22",
            },
            body: JSON.stringify({
              data: {
                type: "profile-subscription-bulk-create-job",
                attributes: {
                  profiles: {
                    data: [{
                      type: "profile",
                      attributes: {
                        email,
                        subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                      },
                    }],
                  },
                },
                relationships: {
                  list: { data: { type: "list", id: config.klaviyo_list_id } },
                },
              },
            }),
          },
        );
        if (response.ok) {
          await supabase
            .from("newsletter_subscribers")
            .update({ sync_status: "synced" })
            .eq("id", subscriber.id);
        }
      } catch (syncError) {
        console.error("Klaviyo sync fout:", syncError);
      }
    } else {
      // MAIL-2a: staat de welkomstreeks (automation) aan, dan krijgt de abonnee enkel die reeks en
      // niet de oude losse welkomstmail. Nooit allebei. Lukt het inplannen niet (fout, of de
      // databank weigert: geen toestemming, al eens gehad), dan ook geen oude mail: de reeks is
      // de keuze van de winkel.
      const { data: welcomeAuto, error: autoErr } = await supabase
        .from("email_automations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("preset_key", "welcome_series")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (autoErr) console.error("[NIEUWSBRIEF-BEVESTIG] welkomstreeks opzoeken mislukt:", autoErr.message);
      if (welcomeAuto?.id) {
        const { error: runErr } = await supabase.rpc("schedule_automation_run_v2", {
          p_tenant_id: tenantId,
          p_trigger_type: "newsletter_confirmed",
          p_trigger_entity_id: subscriber.id,
          p_trigger_entity_type: "newsletter_subscriber",
          p_email: email,
          p_customer_id: null,
          p_metadata: { locale: language ?? null, first_name: subscriber.first_name ?? null },
        });
        if (runErr) console.error("[NIEUWSBRIEF-BEVESTIG] welkomstreeks inplannen mislukt:", runErr.message);
      } else if (!autoErr) {
        // Interne provider zonder welkomstreeks: de oude welkomstmail, pas nu na bevestiging.
        await sendWelcomeEmail(supabase, tenantId, email, subscriber.first_name, config, brand, shopUrl);
      }
    }

    return resultRedirect("ok", locale, brand, shopUrl);
  } catch (error) {
    console.error("[NIEUWSBRIEF-BEVESTIG] fout:", error);
    return resultRedirect("error", locale, brand, shopUrl);
  }
});

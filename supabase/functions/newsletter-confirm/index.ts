import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getTenantBrand, type TenantBrand } from "../_shared/tenantEmail.ts";
import { tenantMarketingSender, tenantSender } from "../_shared/emailSenders.ts";
import { buildUnsubscribeUrl, escapeHtml } from "../_shared/marketingToken.ts";

// MAIL-1a (19 okt 2026): double opt-in staat aan voor alle winkels.
// storefront-api zet een inschrijving op `pending` en mailt een link naar deze
// functie (?token=<confirmation_token>&tenant=<tenantId>). Hier wordt de
// inschrijving pas actief, krijgt de klant `email_subscribed = true` en vertrekt
// de welkomstmail. Idempotent: een tweede klik verstuurt niets opnieuw.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const HTML_HEADERS = { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" };

type Locale = "nl" | "en" | "fr" | "de";

const PAGE_STRINGS: Record<Locale, {
  okTitle: string; okBody: string; alreadyTitle: string; alreadyBody: string;
  invalidTitle: string; invalidBody: string; errorTitle: string; errorBody: string; back: string;
}> = {
  nl: {
    okTitle: "Je inschrijving is bevestigd",
    okBody: "Bedankt! Je ontvangt voortaan de nieuwsbrief van {shop}.",
    alreadyTitle: "Je inschrijving was al bevestigd",
    alreadyBody: "Je staat al op de nieuwsbrief van {shop}. Je hoeft niets meer te doen.",
    invalidTitle: "Deze link is ongeldig",
    invalidBody: "Deze bevestigingslink is ongeldig of niet meer geldig. Schrijf je opnieuw in via de webshop.",
    errorTitle: "Er ging iets mis",
    errorBody: "We konden je inschrijving nu niet bevestigen. Probeer het later opnieuw.",
    back: "Naar de webshop",
  },
  en: {
    okTitle: "Your subscription is confirmed",
    okBody: "Thank you! From now on you'll receive the {shop} newsletter.",
    alreadyTitle: "Your subscription was already confirmed",
    alreadyBody: "You're already subscribed to the {shop} newsletter. Nothing else to do.",
    invalidTitle: "This link is invalid",
    invalidBody: "This confirmation link is invalid or no longer valid. Please subscribe again via the shop.",
    errorTitle: "Something went wrong",
    errorBody: "We couldn't confirm your subscription right now. Please try again later.",
    back: "Back to the shop",
  },
  fr: {
    okTitle: "Votre inscription est confirmée",
    okBody: "Merci ! Vous recevrez désormais la newsletter de {shop}.",
    alreadyTitle: "Votre inscription était déjà confirmée",
    alreadyBody: "Vous êtes déjà inscrit à la newsletter de {shop}. Rien d'autre à faire.",
    invalidTitle: "Ce lien n'est pas valide",
    invalidBody: "Ce lien de confirmation n'est pas ou plus valide. Inscrivez-vous à nouveau via la boutique.",
    errorTitle: "Une erreur s'est produite",
    errorBody: "Nous n'avons pas pu confirmer votre inscription. Réessayez plus tard.",
    back: "Retour à la boutique",
  },
  de: {
    okTitle: "Deine Anmeldung ist bestätigt",
    okBody: "Danke! Ab jetzt erhältst du den Newsletter von {shop}.",
    alreadyTitle: "Deine Anmeldung war bereits bestätigt",
    alreadyBody: "Du bist bereits für den Newsletter von {shop} angemeldet. Du musst nichts mehr tun.",
    invalidTitle: "Dieser Link ist ungültig",
    invalidBody: "Dieser Bestätigungslink ist ungültig oder nicht mehr gültig. Melde dich im Shop erneut an.",
    errorTitle: "Etwas ist schiefgelaufen",
    errorBody: "Wir konnten deine Anmeldung gerade nicht bestätigen. Versuche es später erneut.",
    back: "Zurück zum Shop",
  },
};

const pickLocale = (v: unknown, fallback: Locale = "nl"): Locale => {
  const s = String(v || "").toLowerCase().slice(0, 2);
  return (["nl", "en", "fr", "de"] as const).includes(s as Locale) ? (s as Locale) : fallback;
};

/** Eenvoudige pagina in de huisstijl van de winkel. Alle waarden ge-escaped. */
function renderPage(opts: {
  locale: Locale;
  title: string;
  body: string;
  brand?: TenantBrand | null;
  shopUrl?: string;
  backLabel?: string;
}): string {
  const b = opts.brand;
  const primary = b?.primaryColor || "#1a2332";
  const bg = b?.backgroundColor || "#f5f5f5";
  const text = b?.textColor || "#1a2332";
  const logo = b?.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.tenantName)}" style="max-height:56px;max-width:200px;margin:0 auto 24px;display:block;" />`
    : "";
  const back = opts.shopUrl && /^https?:\/\//i.test(opts.shopUrl)
    ? `<p style="margin-top:28px;"><a href="${escapeHtml(opts.shopUrl)}" style="display:inline-block;background:${escapeHtml(primary)};color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(opts.backLabel || "")}</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(opts.title)}${b ? ` - ${escapeHtml(b.tenantName)}` : ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${escapeHtml(bg)}; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; color: ${escapeHtml(text)}; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    ${logo}
    <h1>${escapeHtml(opts.title)}</h1>
    <p>${escapeHtml(opts.body)}</p>
    ${back}
  </div>
</body>
</html>`;
}

/** Publieke shop-URL voor {{SHOP_URL}} / {{company_website}} en de terugknop. */
async function resolveShopUrl(supabase: any, tenantId: string, brand: TenantBrand): Promise<string> {
  if (brand.websiteUrl) return brand.websiteUrl;
  try {
    const { data } = await supabase
      .from("tenant_domains").select("domain")
      .eq("tenant_id", tenantId).eq("is_active", true).eq("dns_verified", true).eq("is_canonical", true)
      .limit(1).maybeSingle();
    if (data?.domain) return `https://${data.domain}`;
  } catch (_e) { /* val terug op sellqo.shop */ }
  const slug = brand.senderSource.slug;
  return slug ? `https://${slug}.sellqo.shop` : "";
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
    return new Response(null, { headers: corsHeaders });
  }

  const token = url.searchParams.get("token");
  const tenantId = url.searchParams.get("tenant");
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!token || !tenantId || !uuidRe.test(token) || !uuidRe.test(tenantId)) {
    const s = PAGE_STRINGS.nl;
    return new Response(renderPage({ locale: "nl", title: s.invalidTitle, body: s.invalidBody }), {
      status: 400, headers: HTML_HEADERS,
    });
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
    const s = PAGE_STRINGS[locale];
    const fill = (v: string) => v.split("{shop}").join(brand!.tenantName);

    if (error || !subscriber) {
      return new Response(renderPage({ locale, title: s.invalidTitle, body: s.invalidBody, brand, shopUrl, backLabel: s.back }), {
        status: 404, headers: HTML_HEADERS,
      });
    }

    if (subscriber.status === "active") {
      return new Response(renderPage({ locale, title: s.alreadyTitle, body: fill(s.alreadyBody), brand, shopUrl, backLabel: s.back }), {
        headers: HTML_HEADERS,
      });
    }

    // Alleen een openstaande inschrijving mag bevestigd worden. Wie zich
    // uitschreef, wordt niet heringeschreven door een oude bevestigingslink.
    if (subscriber.status && subscriber.status !== "pending") {
      return new Response(renderPage({ locale, title: s.invalidTitle, body: s.invalidBody, brand, shopUrl, backLabel: s.back }), {
        status: 410, headers: HTML_HEADERS,
      });
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
      return new Response(renderPage({ locale, title: s.alreadyTitle, body: fill(s.alreadyBody), brand, shopUrl, backLabel: s.back }), {
        headers: HTML_HEADERS,
      });
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
      // Interne provider: welkomstmail pas nu, na bevestiging.
      await sendWelcomeEmail(supabase, tenantId, email, subscriber.first_name, config, brand, shopUrl);
    }

    return new Response(renderPage({ locale, title: s.okTitle, body: fill(s.okBody), brand, shopUrl, backLabel: s.back }), {
      headers: HTML_HEADERS,
    });
  } catch (error) {
    console.error("[NIEUWSBRIEF-BEVESTIG] fout:", error);
    const s = PAGE_STRINGS[locale];
    return new Response(renderPage({ locale, title: s.errorTitle, body: s.errorBody, brand, shopUrl, backLabel: s.back }), {
      status: 500, headers: HTML_HEADERS,
    });
  }
});

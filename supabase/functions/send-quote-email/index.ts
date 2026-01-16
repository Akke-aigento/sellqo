import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SEND-QUOTE-EMAIL] ${step}`, details ? JSON.stringify(details) : '');
};

// EU countries for VAT purposes
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// 4-language VAT invoice texts - legally correct texts per EU Directive 2006/112/EC
type SupportedLanguage = 'nl' | 'en' | 'fr' | 'de';

const VAT_TEXTS = {
  // Intra-Community supply of GOODS (B2B) - Article 138
  intracom_goods: {
    nl: 'Intracommunautaire levering vrijgesteld van BTW - art. 138 BTW-richtlijn 2006/112/EG',
    en: 'Intra-Community supply exempt from VAT - Art. 138 VAT Directive 2006/112/EC',
    fr: 'Livraison intracommunautaire exonérée de TVA - Art. 138 Directive TVA 2006/112/CE',
    de: 'Innergemeinschaftliche Lieferung umsatzsteuerfrei - Art. 138 MwSt-Richtlinie 2006/112/EG',
  },
  // Intra-Community SERVICES (B2B) - Article 196 (Reverse Charge)
  intracom_services: {
    nl: 'BTW verlegd naar afnemer - art. 196 BTW-richtlijn 2006/112/EG',
    en: 'VAT reverse charged to customer - Art. 196 VAT Directive 2006/112/EC',
    fr: 'TVA autoliquidée par le preneur - Art. 196 Directive TVA 2006/112/CE',
    de: 'Steuerschuldnerschaft des Leistungsempfängers - Art. 196 MwSt-Richtlinie 2006/112/EG',
  },
  // Export outside EU - Article 146
  export: {
    nl: 'Uitvoer vrijgesteld van BTW - art. 146 BTW-richtlijn 2006/112/EG',
    en: 'Export exempt from VAT - Art. 146 VAT Directive 2006/112/EC',
    fr: 'Exportation exonérée de TVA - Art. 146 Directive TVA 2006/112/CE',
    de: 'Ausfuhr umsatzsteuerfrei - Art. 146 MwSt-Richtlinie 2006/112/EG',
  },
  // OSS Scheme applied
  oss: {
    nl: 'BTW berekend volgens OSS-regeling (One-Stop-Shop) - bestemmingsland tarief',
    en: 'VAT calculated under OSS scheme (One-Stop-Shop) - destination country rate',
    fr: 'TVA calculée selon le régime OSS (guichet unique) - taux du pays de destination',
    de: 'MwSt berechnet nach OSS-Regelung (One-Stop-Shop) - Steuersatz des Bestimmungslandes',
  },
};

// Get customer language, defaulting to tenant language or 'nl'
function getCustomerLanguage(customer: any, tenant: any): SupportedLanguage {
  const countryToLanguage: Record<string, SupportedLanguage> = {
    'NL': 'nl', 'BE': 'nl',
    'DE': 'de', 'AT': 'de', 'CH': 'de', 'LU': 'de',
    'FR': 'fr', 
    'GB': 'en', 'IE': 'en', 'US': 'en', 'CA': 'en', 'AU': 'en',
  };
  
  const customerCountry = customer?.billing_country || customer?.shipping_country || '';
  const inferredLang = countryToLanguage[customerCountry];
  
  if (inferredLang) return inferredLang;
  
  const tenantLang = tenant?.language?.toLowerCase() as SupportedLanguage;
  if (['nl', 'en', 'fr', 'de'].includes(tenantLang)) return tenantLang;
  
  return 'nl';
}

interface VatCalculation {
  vatRate: number;
  vatAmount: number;
  vatType: 'standard' | 'reverse_charge' | 'export' | 'oss';
  vatText: string | null;
}

function calculateVat(params: {
  subtotal: number;
  tenant: any;
  customer: any;
  customerCountry: string;
}): VatCalculation {
  const { subtotal, tenant, customer, customerCountry } = params;
  const tenantCountry = tenant.country || 'NL';
  const taxPercent = tenant.tax_percentage || 21;
  const isB2B = customer?.customer_type === 'b2b';
  const hasValidVat = customer?.vat_verified === true;
  const isEuCountry = EU_COUNTRIES.includes(customerCountry);
  const isSameCountry = customerCountry === tenantCountry;

  const lang = getCustomerLanguage(customer, tenant);

  logStep("VAT calculation", { tenantCountry, customerCountry, isB2B, hasValidVat, isEuCountry, isSameCountry, lang });

  // Same country - always apply local VAT
  if (isSameCountry) {
    return {
      vatRate: taxPercent,
      vatAmount: subtotal * (taxPercent / 100),
      vatType: 'standard',
      vatText: null,
    };
  }

  // B2B with valid VAT number in EU - Reverse Charge
  if (isB2B && hasValidVat && isEuCountry) {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'reverse_charge',
      vatText: VAT_TEXTS.intracom_services[lang],
    };
  }

  // Export outside EU
  if (!isEuCountry) {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'export',
      vatText: VAT_TEXTS.export[lang],
    };
  }

  // B2C in EU with OSS enabled
  if (!isB2B && isEuCountry && tenant.apply_oss_rules) {
    const ossRates: Record<string, number> = {
      'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
      'DK': 25, 'EE': 22, 'FI': 25.5, 'FR': 20, 'DE': 19, 'GR': 24,
      'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
      'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 23,
      'SI': 22, 'ES': 21, 'SE': 25
    };
    const ossRate = ossRates[customerCountry] || taxPercent;
    return {
      vatRate: ossRate,
      vatAmount: subtotal * (ossRate / 100),
      vatType: 'oss',
      vatText: `${VAT_TEXTS.oss[lang]} (${ossRate}% ${customerCountry})`,
    };
  }

  // Default: apply local VAT
  return {
    vatRate: taxPercent,
    vatAmount: subtotal * (taxPercent / 100),
    vatType: 'standard',
    vatText: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quoteId } = await req.json();
    logStep("Request received", { quoteId });

    if (!quoteId) {
      throw new Error("Quote ID is required");
    }

    // Fetch quote with items and customer
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        *,
        customer:customers(*),
        quote_items(*)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quote not found: ${quoteError?.message}`);
    }

    logStep("Quote fetched", { quoteNumber: quote.quote_number });

    // Fetch tenant for branding
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", quote.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    logStep("Tenant fetched", { tenantName: tenant.name });

    if (!quote.customer?.email) {
      throw new Error("Customer email not found");
    }

    const customerName = quote.customer.first_name 
      ? `${quote.customer.first_name} ${quote.customer.last_name || ''}`.trim()
      : 'Geachte klant';

    const validUntilDate = quote.valid_until 
      ? new Date(quote.valid_until).toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : null;

    // Calculate VAT based on customer type and location
    const customerCountry = quote.customer.billing_country || tenant.country || 'NL';
    const subtotal = Number(quote.subtotal);
    const vatCalculation = calculateVat({
      subtotal,
      tenant,
      customer: quote.customer,
      customerCountry,
    });

    logStep("VAT calculated for quote", vatCalculation);

    // Calculate final totals
    const taxAmount = vatCalculation.vatAmount;
    const discountAmount = Number(quote.discount_amount) || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Build items HTML
    const itemsHtml = quote.quote_items.map((item: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${item.product_name}
          ${item.description ? `<br><small style="color: #6b7280;">${item.description}</small>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${Number(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('');

    // Build VAT display for email
    let vatDisplayHtml = '';
    if (vatCalculation.vatType === 'reverse_charge') {
      vatDisplayHtml = `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">BTW (0%)</td>
          <td style="padding: 12px; text-align: right;">€0,00</td>
        </tr>
        <tr>
          <td colspan="4" style="padding: 12px; font-size: 12px; color: #92400e; background-color: #fef3c7;">
            ${vatCalculation.vatText}
          </td>
        </tr>
      `;
    } else if (vatCalculation.vatType === 'export') {
      vatDisplayHtml = `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">BTW (0%)</td>
          <td style="padding: 12px; text-align: right;">€0,00</td>
        </tr>
        <tr>
          <td colspan="4" style="padding: 12px; font-size: 12px; color: #92400e; background-color: #fef3c7;">
            ${vatCalculation.vatText}
          </td>
        </tr>
      `;
    } else if (vatCalculation.vatType === 'oss') {
      vatDisplayHtml = `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">BTW (${vatCalculation.vatRate}% OSS)</td>
          <td style="padding: 12px; text-align: right;">€${taxAmount.toFixed(2)}</td>
        </tr>
      `;
    } else {
      vatDisplayHtml = `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">BTW (${vatCalculation.vatRate}%)</td>
          <td style="padding: 12px; text-align: right;">€${taxAmount.toFixed(2)}</td>
        </tr>
      `;
    }

    // Customer company info for B2B
    const customerDisplayName = quote.customer.company_name 
      ? quote.customer.company_name
      : customerName;

    const customerVatInfo = quote.customer.vat_number 
      ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">BTW-nummer: ${quote.customer.vat_number}</p>` 
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; background-color: ${tenant.primary_color || '#3b82f6'};">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">${tenant.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Offerte ${quote.quote_number}</h2>
              
              <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0; font-weight: 600;">${customerDisplayName}</p>
                ${quote.customer.company_name && quote.customer.first_name ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">t.a.v. ${customerName}</p>` : ''}
                ${customerVatInfo}
              </div>
              
              <p style="margin: 0 0 20px 0; color: #374151; line-height: 1.6;">
                Beste ${customerName},
              </p>
              <p style="margin: 0 0 20px 0; color: #374151; line-height: 1.6;">
                Hierbij ontvangt u onze offerte. Hieronder vindt u een overzicht van de producten en/of diensten.
              </p>
              
              ${validUntilDate ? `
                <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
                  <strong>Geldig tot:</strong> ${validUntilDate}
                </p>
              ` : ''}
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Omschrijving</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Aantal</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Prijs</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">Subtotaal</td>
                    <td style="padding: 12px; text-align: right;">€${subtotal.toFixed(2)}</td>
                  </tr>
                  ${vatDisplayHtml}
                  ${discountAmount > 0 ? `
                    <tr>
                      <td colspan="3" style="padding: 12px; text-align: right; color: #059669;">Korting</td>
                      <td style="padding: 12px; text-align: right; color: #059669;">-€${discountAmount.toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  <tr style="background-color: #f9fafb;">
                    <td colspan="3" style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px;">Totaal</td>
                    <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px;">€${total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              
              ${quote.notes ? `
                <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                  <p style="margin: 0; color: #374151; font-size: 14px;">${quote.notes}</p>
                </div>
              ` : ''}
              
              ${quote.payment_link ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${quote.payment_link}" style="display: inline-block; padding: 16px 32px; background-color: ${tenant.primary_color || '#3b82f6'}; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px;">
                    Offerte accepteren & betalen
                  </a>
                </div>
              ` : ''}
              
              <p style="margin: 30px 0 0 0; color: #374151; line-height: 1.6;">
                Met vriendelijke groet,<br>
                <strong>${tenant.name}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                ${tenant.address ? `${tenant.address}, ` : ''}${tenant.postal_code ? `${tenant.postal_code} ` : ''}${tenant.city || ''} ${tenant.country || ''}
                ${tenant.phone ? `<br>Tel: ${tenant.phone}` : ''}
                ${tenant.owner_email ? `<br>${tenant.owner_email}` : ''}
                ${tenant.btw_number ? `<br>BTW: ${tenant.btw_number}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    logStep("Sending email", { to: quote.customer.email });

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${tenant.name} <onboarding@resend.dev>`,
      to: [quote.customer.email],
      subject: `Offerte ${quote.quote_number} van ${tenant.name}`,
      html: emailHtml,
    });

    logStep("Email sent", { emailResponse });

    // Update quote with recalculated tax amount and status
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
        tax_amount: taxAmount,
        total: total,
      })
      .eq("id", quoteId);

    if (updateError) {
      console.error("Error updating quote status:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        emailResponse,
        vat_type: vatCalculation.vatType,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Error sending quote email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});

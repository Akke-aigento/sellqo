/**
 * Edge-function copy of src/lib/emailContent.ts helpers plus the shared
 * variable-map builder used by send-campaign-batch. Kept in sync manually.
 */

import { resolveCustomerContactEmail } from "./customerContact.ts";

export function extractEmailBody(html: string): string {
  if (!html) return '';
  const looksLikeDocument = /<!doctype|<html[\s>]/i.test(html);

  let body = html;
  if (looksLikeDocument) {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (match) body = match[1];
  }

  body = body.replace(
    /<tr[^>]*>[\s\S]*?\{\{\s*unsubscribe_url\s*\}\}[\s\S]*?<\/tr>/gi,
    '',
  );

  const legacyShell = body.match(
    /^\s*<table[^>]*>\s*<tr[^>]*>\s*<td[^>]*style="[^"]*padding:\s*40px\s*30px[^"]*"[^>]*>([\s\S]*?)<\/td>\s*<\/tr>\s*<\/table>\s*$/i,
  );
  if (legacyShell) body = legacyShell[1];

  return body.trim();
}

// Minimal shape used by buildVariableMap — matches the recipient/tenant
// selects performed in send-campaign-batch.
export interface VarRecipient {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  vat_number?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
  total_orders?: number | null;
  total_spent?: number | null;
}

// MAIL-CONTACT-1: velden zoals ze op `tenants` bestaan. `email` en `street`
// stonden hier eerder in; die kolommen bestaan niet, en send-campaign-batch
// vroeg ze op — waardoor de hele select faalde en {{company_email}} en
// {{company_address}} altijd leeg of fout waren.
export interface VarTenant {
  name?: string | null;
  support_email?: string | null;
  slug?: string | null;
  inbound_email_prefix?: string | null;
  phone?: string | null;
  custom_domain?: string | null;
  iban?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface VarCampaign {
  subject: string;
}

function localeTag(locale?: string): string {
  switch ((locale || 'nl').toLowerCase()) {
    case 'fr': return 'fr-BE';
    case 'de': return 'de-DE';
    case 'en': return 'en-GB';
    case 'nl':
    default: return 'nl-BE';
  }
}

function fmtCurrency(v: number | null | undefined, locale = 'nl-BE'): string {
  const n = typeof v === 'number' ? v : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return `€ ${n.toFixed(2)}`;
  }
}

function fmtDate(locale = 'nl-BE'): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface VarTenantBrand {
  tenantName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  headingFont?: string;
}

/**
 * Build the complete replacement map for every variable advertised in
 * VariableInserter. Never leaves undefined entries — missing values become
 * empty strings so the caller can strip unmatched {{…}} tokens safely.
 */
export function buildVariableMap(
  recipient: VarRecipient,
  tenant: VarTenant | null | undefined,
  campaign: VarCampaign,
  unsubscribeUrl: string,
  brand?: VarTenantBrand | null,
  language?: string | null,
): Record<string, string> {
  const t = tenant ?? {};
  const loc = localeTag(language || undefined);
  const firstName = recipient.first_name ?? '';
  const lastName = recipient.last_name ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    || recipient.company_name
    || 'Klant';

  const companyAddress = [
    t.address ?? '',
    [t.postal_code ?? '', t.city ?? ''].filter(Boolean).join(' '),
    t.country ?? '',
  ].filter((p) => p && p.trim().length > 0).join(', ');

  const website = t.custom_domain ? `https://${t.custom_domain}` : '';

  const b = brand ?? {};
  const logoUrl = b.logoUrl ?? '';
  const brandName = b.tenantName ?? (t.name ?? '');
  const logoImg = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(brandName)}" style="height:44px;width:auto;display:block;border:0;outline:none;" />`
    : '';

  return {
    // Customer
    customer_name: fullName,
    customer_first_name: firstName,
    customer_last_name: lastName,
    customer_email: recipient.email ?? '',
    customer_phone: recipient.phone ?? '',
    customer_company: recipient.company_name ?? '',
    customer_vat_number: recipient.vat_number ?? '',
    customer_city: recipient.billing_city ?? '',
    customer_country: recipient.billing_country ?? '',
    total_orders: String(recipient.total_orders ?? 0),
    total_spent: fmtCurrency(recipient.total_spent, loc),

    // Company / tenant
    company_name: t.name ?? '',
    company_email: resolveCustomerContactEmail(t),
    company_phone: t.phone ?? '',
    company_website: website,
    company_address: companyAddress,
    company_iban: t.iban ?? '',

    // Brand
    tenant_logo: logoImg,
    tenant_logo_url: logoUrl,
    brand_primary_color: b.primaryColor ?? '',
    brand_accent_color: b.accentColor ?? '',
    brand_heading_font: b.headingFont ?? '',

    // System
    current_date: fmtDate(loc),
    subject: campaign.subject ?? '',
    unsubscribe_url: unsubscribeUrl,
  };
}

/**
 * Replace every {{var}} occurrence using the map, then strip any remaining
 * unmatched {{…}} tokens so recipients never see raw placeholders.
 */
/**
 * MAIL-LOGO-1 review: een <img> waarvan de src enkel een variabele is die leeg uitvalt (bv.
 * {{tenant_logo_url}} of {{LOGO_URL}} bij een winkel zonder logo) verdwijnt helemaal, in plaats
 * van als <img src=""> (gebroken-beeldicoon) in de mail te staan.
 * `valueOf(token)` krijgt de naam zonder accolades en geeft de waarde, of undefined als onbekend.
 */
export function stripEmptyImageTokens(html: string, valueOf: (token: string) => string | undefined): string {
  if (!html) return '';
  return html.replace(
    /<img\b[^>]*?\bsrc\s*=\s*(["'])\s*\{\{\s*([\w.]+)\s*\}\}\s*\1[^>]*>/gi,
    (tag, _q: string, token: string) => ((valueOf(token) ?? '').trim() === '' ? '' : tag),
  );
}

/**
 * MAIL-CLEAN-1: een eigen, volledig HTML-ontwerp met een eigen afmeldlink. Zo zagen de oude
 * welkomstmails uit Instellingen → Nieuwsbrief eruit (Mancini, VanXcel): een compleet document
 * met <head>-stijlen en een eigen voettekst met {{unsubscribe_url}}. Zo'n mail gaat als
 * automationmail ongewijzigd de deur uit (enkel variabelen ingevuld), zoals de oude route deed.
 * Door extractEmailBody + renderTenantEmail zou hij zijn stijlen verliezen, een tweede kop en
 * voettekst krijgen, en de afmeldrij-regex zou alles vanaf de eerste <tr> wegknippen.
 * Zonder eigen afmeldlink: géén standalone (de SellQo-voettekst met afmeldlink is dan nodig).
 */
export function isStandaloneEmailDocument(html: string): boolean {
  if (!html) return false;
  return /<!doctype|<html[\s>]/i.test(html)
    && /<body[\s>]/i.test(html)
    && /\{\{\s*unsubscribe_url\s*\}\}/.test(html);
}

export function applyVariables(input: string, vars: Record<string, string>): string {
  if (!input) return '';
  input = stripEmptyImageTokens(input, (k) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : ''));
  const out = input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '';
  });
  return out;
}
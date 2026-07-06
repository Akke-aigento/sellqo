/**
 * Edge-function copy of src/lib/emailContent.ts helpers plus the shared
 * variable-map builder used by send-campaign-batch. Kept in sync manually.
 */

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

export interface VarTenant {
  name?: string | null;
  email?: string | null;
  owner_email?: string | null;
  phone?: string | null;
  custom_domain?: string | null;
  iban?: string | null;
  street?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface VarCampaign {
  subject: string;
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
): Record<string, string> {
  const t = tenant ?? {};
  const firstName = recipient.first_name ?? '';
  const lastName = recipient.last_name ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    || recipient.company_name
    || 'Klant';

  const companyAddress = [
    t.street ?? '',
    [t.postal_code ?? '', t.city ?? ''].filter(Boolean).join(' '),
    t.country ?? '',
  ].filter((p) => p && p.trim().length > 0).join(', ');

  const website = t.custom_domain ? `https://${t.custom_domain}` : '';

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
    total_spent: fmtCurrency(recipient.total_spent),

    // Company / tenant
    company_name: t.name ?? '',
    company_email: t.email ?? t.owner_email ?? '',
    company_phone: t.phone ?? '',
    company_website: website,
    company_address: companyAddress,
    company_iban: t.iban ?? '',

    // System
    current_date: fmtDate(),
    subject: campaign.subject ?? '',
    unsubscribe_url: unsubscribeUrl,
  };
}

/**
 * Replace every {{var}} occurrence using the map, then strip any remaining
 * unmatched {{…}} tokens so recipients never see raw placeholders.
 */
export function applyVariables(input: string, vars: Record<string, string>): string {
  if (!input) return '';
  const out = input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '';
  });
  return out;
}
// Stream B (Tenant → Customer) shared email util.
//
// Parallel to `_shared/sellqoEmail.ts`, this module renders tenant-branded
// HTML emails using the same `emailBaseLayout` skeleton, but injects per-tenant
// colors, logo, fonts and footer branding pulled from `tenants` +
// `tenant_theme_settings`.
//
// Edge cases handled:
//   • Missing tenant_theme_settings row → SellQo defaults
//   • Missing or malformed logo_url → SellQo logo fallback
//   • Malformed hex (e.g. 'red', '#zzz') → sanitized to default
//   • Missing locale → falls back via getTenantLocale() to 'en'
//
// All Stream B sender addresses live in `_shared/emailSenders.ts`; this
// module is purely visual/templating.

import {
  BRAND,
  LOGO_URL,
  emailBaseLayout,
  emailButton,
  emailDivider,
  emailTable,
  emailInfoBox,
  htmlToPlainText,
} from "./sellqoEmail.ts";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type TenantLocale = "nl" | "en" | "fr" | "de";
export const SUPPORTED_LOCALES: readonly TenantLocale[] = ["nl", "en", "fr", "de"];

export interface TenantBrand {
  tenantId: string;
  tenantName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  backgroundColor: string;
  cardColor: string;
  borderColor: string;
  brandColor: string;
  themeMode: "light" | "dark";
  headingFont: string;
  bodyFont: string;
  supportEmail: string;
  websiteUrl?: string;
  legalName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  vatNumber?: string;
  defaultLocale: TenantLocale;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const URL_RE = /^https?:\/\//i;

function sanitizeColor(input: unknown, fallback: string): string {
  const v = typeof input === "string" ? input.trim() : "";
  return HEX_RE.test(v) ? v : fallback;
}

function sanitizeUrl(input: unknown, fallback: string): string {
  const v = typeof input === "string" ? input.trim() : "";
  return URL_RE.test(v) ? v : fallback;
}

function sanitizeLocale(input: unknown, fallback: TenantLocale = "en"): TenantLocale {
  const v = String(input || "").toLowerCase().slice(0, 2) as TenantLocale;
  return SUPPORTED_LOCALES.includes(v) ? v : fallback;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pick a readable foreground (white/dark) for a given background hex. */
function pickFg(bg: string): string {
  const h = bg.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#1a2332" : "#ffffff";
}

// ─────────────────────────────────────────────────────────────────────
// Tenant brand resolver
// ─────────────────────────────────────────────────────────────────────

type SbClient = {
  from: (t: string) => any;
};

export async function getTenantBrand(
  supabase: SbClient,
  tenantId: string,
): Promise<TenantBrand> {
  let tenantRow: any = null;
  let themeRow: any = null;

  try {
    const { data } = await supabase
      .from("tenants")
      .select(
        "id, name, legal_name, support_email, owner_email, contact_email, primary_color, logo_url, website_url, address, city, postal_code, country, vat_number, btw_number, language",
      )
      .eq("id", tenantId)
      .maybeSingle();
    tenantRow = data || null;
  } catch (_e) {
    tenantRow = null;
  }

  try {
    const { data } = await supabase
      .from("tenant_theme_settings")
      .select(
        "logo_url, primary_color, secondary_color, accent_color, background_color, text_color, brand_color, theme_mode, heading_font, body_font",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();
    themeRow = data || null;
  } catch (_e) {
    themeRow = null;
  }

  const t = tenantRow || {};
  const th = themeRow || {};

  const supportEmail =
    (t.support_email && String(t.support_email).trim()) ||
    (t.contact_email && String(t.contact_email).trim()) ||
    (t.owner_email && String(t.owner_email).trim()) ||
    "support@sellqo.app";

  return {
    tenantId,
    tenantName: (t.name && String(t.name).trim()) || "SellQo",
    legalName: (t.legal_name && String(t.legal_name).trim()) || undefined,
    logoUrl: sanitizeUrl(th.logo_url || t.logo_url, LOGO_URL),
    primaryColor: sanitizeColor(th.primary_color || t.primary_color, BRAND.primary),
    accentColor: sanitizeColor(th.accent_color, BRAND.accent),
    textColor: sanitizeColor(th.text_color, BRAND.text),
    mutedColor: BRAND.muted,
    backgroundColor: sanitizeColor(th.background_color, BRAND.bg),
    cardColor: BRAND.card,
    borderColor: BRAND.border,
    brandColor: sanitizeColor(th.brand_color || th.primary_color || t.primary_color, BRAND.primary),
    themeMode: th.theme_mode === "dark" ? "dark" : "light",
    headingFont: (typeof th.heading_font === "string" && th.heading_font) || "Inter",
    bodyFont: (typeof th.body_font === "string" && th.body_font) || "Inter",
    supportEmail,
    websiteUrl: (t.website_url && String(t.website_url).trim()) || undefined,
    address: (t.address && String(t.address).trim()) || undefined,
    city: (t.city && String(t.city).trim()) || undefined,
    postalCode: (t.postal_code && String(t.postal_code).trim()) || undefined,
    country: (t.country && String(t.country).trim()) || undefined,
    vatNumber: (t.vat_number || t.btw_number) ? String(t.vat_number || t.btw_number).trim() : undefined,
    defaultLocale: sanitizeLocale(t.language, "nl"),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Building-block helpers (return HTML strings)
// ─────────────────────────────────────────────────────────────────────

export interface OrderLineItem {
  name: string;
  variant?: string;
  quantity: number;
  total: number;
}

export function renderOrderLineItems(
  items: OrderLineItem[],
  currency: string,
  locale: TenantLocale,
  quantityLabel = "Aantal",
): string {
  const fmt = (a: number) => formatAmount(a, currency, locale);
  const rows = items.map((i) => [
    `<div style="font-weight:500;">${esc(i.name)}</div>${
      i.variant ? `<div style="font-size:12px;color:${BRAND.muted};margin-top:2px;">${esc(i.variant)}</div>` : ""
    }<div style="font-size:12px;color:${BRAND.muted};margin-top:2px;">${esc(quantityLabel)}: ${i.quantity}</div>`,
    fmt(i.total),
  ]);
  return emailTable({ rows });
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export function renderInvoiceLineItems(
  lines: InvoiceLine[],
  currency: string,
  locale: TenantLocale,
  headers: string[] = ["Omschrijving", "Aantal", "Prijs", "Totaal"],
): string {
  const fmt = (a: number) => formatAmount(a, currency, locale);
  const rows = lines.map((l) => [
    esc(l.description),
    String(l.quantity),
    fmt(l.unitPrice),
    fmt(l.total),
  ]);
  return emailTable({ headers, rows });
}

export function renderQuoteLineItems(
  lines: InvoiceLine[],
  currency: string,
  locale: TenantLocale,
  headers?: string[],
): string {
  return renderInvoiceLineItems(lines, currency, locale, headers);
}

export interface EmailAddress {
  name?: string;
  line1?: string;
  line2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export function renderAddressBlocks(opts: {
  shipping?: EmailAddress;
  billing?: EmailAddress;
  shippingLabel?: string;
  billingLabel?: string;
}): string {
  const block = (label: string, a?: EmailAddress) => {
    if (!a) return "";
    const lines = [a.name, a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(" "), a.country]
      .filter(Boolean)
      .map((s) => esc(String(s)));
    if (!lines.length) return "";
    return `<div style="font-family:Arial,sans-serif;font-size:12px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${esc(label)}</div><div style="font-size:14px;color:${BRAND.text};line-height:1.6;">${lines.join("<br/>")}</div>`;
  };
  const left = block(opts.shippingLabel || "Verzendadres", opts.shipping);
  const right = block(opts.billingLabel || "Factuuradres", opts.billing);
  if (!left && !right) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;"><tr>
    <td valign="top" width="50%" style="padding:16px;background:#f9fafb;border-radius:8px;vertical-align:top;">${left}</td>
    <td width="16"></td>
    <td valign="top" width="50%" style="padding:16px;background:#f9fafb;border-radius:8px;vertical-align:top;">${right}</td>
  </tr></table>`;
}

export function renderTotalsBreakdown(opts: {
  subtotal: number;
  shipping?: number;
  tax?: number;
  discount?: number;
  total: number;
  currency: string;
  locale: TenantLocale;
  labels?: { subtotal: string; shipping: string; tax: string; discount: string; total: string };
  accentColor?: string;
}): string {
  const L = opts.labels || { subtotal: "Subtotaal", shipping: "Verzending", tax: "BTW", discount: "Korting", total: "Totaal" };
  const fmt = (a: number) => formatAmount(a, opts.currency, opts.locale);
  const accent = opts.accentColor || BRAND.primary;
  const row = (label: string, value: string, opts2: { bold?: boolean; color?: string } = {}) =>
    `<tr><td align="right" style="padding:6px 8px;font-size:14px;color:${opts2.color || BRAND.muted};${opts2.bold ? "font-weight:700;" : ""}">${esc(label)}</td><td align="right" style="padding:6px 8px;font-size:14px;color:${opts2.color || BRAND.text};${opts2.bold ? "font-weight:700;" : ""};white-space:nowrap;">${esc(value)}</td></tr>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">
    ${row(L.subtotal, fmt(opts.subtotal))}
    ${opts.shipping ? row(L.shipping, fmt(opts.shipping)) : ""}
    ${opts.discount ? row(L.discount, `-${fmt(opts.discount)}`, { color: "#059669" }) : ""}
    ${opts.tax ? row(L.tax, fmt(opts.tax)) : ""}
    <tr><td colspan="2" style="border-top:2px solid ${BRAND.border};padding:0;font-size:0;line-height:0;">&nbsp;</td></tr>
    ${row(L.total, fmt(opts.total), { bold: true, color: accent })}
  </table>`;
}

export function renderPaymentInstructions(opts: {
  iban: string;
  bic?: string;
  reference: string;
  amount: number;
  currency: string;
  locale: TenantLocale;
  beneficiary?: string;
  labels?: { title: string; iban: string; bic: string; ref: string; amount: string; beneficiary: string };
}): string {
  const L = opts.labels || {
    title: "Betaalgegevens",
    iban: "IBAN",
    bic: "BIC",
    ref: "Mededeling",
    amount: "Bedrag",
    beneficiary: "Begunstigde",
  };
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 8px;color:${BRAND.muted};font-size:13px;">${esc(label)}</td><td style="padding:6px 8px;color:${BRAND.text};font-size:14px;font-weight:600;font-family:monospace;">${esc(value)}</td></tr>`;
  return `<div style="margin:20px 0;padding:16px 20px;background:#f7f9fc;border:1px solid ${BRAND.border};border-radius:8px;">
    <div style="font-size:13px;font-weight:600;color:${BRAND.text};margin-bottom:8px;">${esc(L.title)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      ${opts.beneficiary ? row(L.beneficiary, opts.beneficiary) : ""}
      ${row(L.iban, opts.iban)}
      ${opts.bic ? row(L.bic, opts.bic) : ""}
      ${row(L.ref, opts.reference)}
      ${row(L.amount, formatAmount(opts.amount, opts.currency, opts.locale))}
    </table>
  </div>`;
}

export function renderTrackingInfo(opts: {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  label?: string;
}): string {
  const label = opts.label || "Track & Trace";
  const inner = opts.trackingUrl
    ? `<a href="${esc(opts.trackingUrl)}" style="color:${BRAND.primary};text-decoration:underline;font-weight:600;">${esc(opts.trackingNumber)}</a>`
    : `<span style="font-weight:600;">${esc(opts.trackingNumber)}</span>`;
  return emailInfoBox({
    title: `${label} — ${opts.carrier}`,
    subtitle: opts.trackingUrl ? "Klik op het nummer om je pakket te volgen." : undefined,
  }) + `<p style="margin:-12px 0 24px;font-size:14px;color:${BRAND.text};">${inner}</p>`;
}

export function renderGiftCardVisual(opts: {
  code: string;
  amount: number;
  currency: string;
  locale: TenantLocale;
  expiresAt?: string;
  brandColor?: string;
}): string {
  const accent = opts.brandColor || BRAND.primary;
  const fg = pickFg(accent);
  return `<div style="margin:24px 0;padding:32px 24px;background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%);border:2px dashed ${accent};border-radius:14px;text-align:center;font-family:Arial,sans-serif;">
    <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Cadeaukaart</div>
    <div style="font-family:'Courier New',monospace;font-size:26px;font-weight:700;color:${BRAND.text};letter-spacing:3px;margin-bottom:16px;">${esc(opts.code)}</div>
    <div style="display:inline-block;padding:10px 24px;border-radius:9999px;background:${accent};color:${fg};font-size:20px;font-weight:700;">${formatAmount(opts.amount, opts.currency, opts.locale)}</div>
    ${opts.expiresAt ? `<div style="margin-top:14px;font-size:13px;color:${BRAND.muted};">⏰ ${esc(opts.expiresAt)}</div>` : ""}
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────
// renderTenantEmail
// ─────────────────────────────────────────────────────────────────────

export interface RenderTenantEmailOptions {
  tenantBrand: TenantBrand;
  locale: TenantLocale;
  preheader?: string;
  heading: string;
  intro?: string;          // raw HTML allowed
  content?: string;        // template-specific HTML body
  primaryCta?: { label: string; url: string };
  secondaryCta?: { label: string; url: string };
  footerNote?: string;
  unsubscribeUrl?: string;
  showSellqoFooter?: boolean;
  /** Optional poweredBy localised label (e.g. "Powered by SellQo"). */
  poweredByLabel?: string;
}

export function renderTenantEmail(opts: RenderTenantEmailOptions): { html: string; text: string } {
  const b = opts.tenantBrand;
  const sellqoFooter = opts.showSellqoFooter !== false;
  const headingFont = `${b.headingFont}, ${BRAND.primary === "" ? "" : ""}-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;
  const bodyFont = `${b.bodyFont}, -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;

  // Header with tenant logo + name
  const header = `<tr><td align="center" style="padding:0 0 24px;">
    <a href="${esc(b.websiteUrl || "https://sellqo.app")}" target="_blank" style="text-decoration:none;">
      <img src="${esc(b.logoUrl)}" alt="${esc(b.tenantName)}" style="height:44px;width:auto;display:block;border:0;outline:none;margin:0 auto;" />
    </a>
  </td></tr>`;

  const primaryBtn = opts.primaryCta
    ? renderBrandedButton(opts.primaryCta.label, opts.primaryCta.url, b.primaryColor, pickFg(b.primaryColor))
    : "";
  const secondaryBtn = opts.secondaryCta
    ? `<div style="margin-top:12px;">${renderBrandedButton(opts.secondaryCta.label, opts.secondaryCta.url, "#ffffff", b.primaryColor, b.primaryColor)}</div>`
    : "";

  const content = `<tr><td class="sq-card" style="background-color:${b.cardColor};border:1px solid ${b.borderColor};border-radius:12px;padding:40px;font-family:${bodyFont};color:${b.textColor};">
    <h1 style="margin:0 0 16px;font-family:${headingFont};font-size:22px;line-height:1.3;font-weight:700;color:${b.textColor};">${esc(opts.heading)}</h1>
    ${opts.intro ? `<div style="font-size:15px;line-height:1.65;color:${b.textColor};">${opts.intro}</div>` : ""}
    ${opts.content || ""}
    ${primaryBtn}
    ${secondaryBtn}
  </td></tr>`;

  // Tenant footer block
  const addr = [b.address, b.postalCode, b.city, b.country].filter(Boolean).join(", ");
  const poweredBy = sellqoFooter
    ? `<p style="margin:10px 0 0;font-size:11px;color:${BRAND.footerText};line-height:1.5;">${esc(opts.poweredByLabel || "Mogelijk gemaakt door SellQo")} · <a href="https://sellqo.app" style="color:${BRAND.footerText};text-decoration:underline;">sellqo.app</a></p>`
    : "";
  const unsubscribeLink = opts.unsubscribeUrl
    ? `<p style="margin:6px 0 0;font-size:11px;color:${BRAND.footerText};"><a href="${esc(opts.unsubscribeUrl)}" style="color:${BRAND.footerText};text-decoration:underline;">Uitschrijven</a></p>`
    : "";
  const footer = `<tr><td class="sq-footer" style="padding:24px 24px 8px;font-family:${bodyFont};text-align:center;">
    ${opts.footerNote ? `<p style="margin:0 0 8px;font-size:12px;color:${BRAND.footerText};">${opts.footerNote}</p>` : ""}
    <p style="margin:0 0 4px;font-size:12px;color:${BRAND.footerText};line-height:1.5;"><strong>${esc(b.tenantName)}</strong>${addr ? ` · ${esc(addr)}` : ""}</p>
    <p style="margin:0;font-size:12px;color:${BRAND.footerText};line-height:1.5;"><a href="mailto:${esc(b.supportEmail)}" style="color:${BRAND.footerText};text-decoration:underline;">${esc(b.supportEmail)}</a>${b.vatNumber ? ` · BTW ${esc(b.vatNumber)}` : ""}</p>
    ${unsubscribeLink}
    ${poweredBy}
  </td></tr>`;

  const html = emailBaseLayout({
    preheader: opts.preheader,
    brand: {
      primary: b.primaryColor,
      accent: b.accentColor,
      bg: b.backgroundColor,
      card: b.cardColor,
      border: b.borderColor,
      text: b.textColor,
    },
    content,
    footer,
    header,
    darkMode: true,
    lang: opts.locale,
  });

  return { html, text: htmlToPlainText(html) };
}

// Branded button (custom color, since emailButton uses BRAND.primary)
function renderBrandedButton(label: string, url: string, bg: string, fg: string, borderColor?: string): string {
  const border = borderColor || bg;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
    <tr><td align="center" bgcolor="${bg}" style="border-radius:8px;border:1px solid ${border};">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(url)}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="${border}" fillcolor="${bg}"><w:anchorlock/><center style="color:${fg};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(label)}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!-- --><a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;font-weight:600;color:${fg};text-decoration:none;border-radius:8px;background-color:${bg};mso-hide:all;">${esc(label)}</a><!--<![endif]-->
    </td></tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────
// Currency formatting + locale resolution
// ─────────────────────────────────────────────────────────────────────

export function formatAmount(amount: number, currency: string, locale: TenantLocale): string {
  const m: Record<TenantLocale, string> = { nl: "nl-NL", en: "en-US", fr: "fr-FR", de: "de-DE" };
  try {
    return new Intl.NumberFormat(m[locale], { style: "currency", currency: currency || "EUR" }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency || "EUR"}`;
  }
}

/** Resolve email locale: explicit > customer.locale > tenant.default_locale > 'en'. */
export async function resolveEmailLocale(
  supabase: SbClient,
  opts: {
    explicit?: string | null;
    customerLocale?: string | null;
    tenantId: string;
    countryCode?: string | null;
    tenantDefault?: TenantLocale;
  },
): Promise<TenantLocale> {
  if (opts.explicit) {
    const l = sanitizeLocale(opts.explicit, "en");
    if (l) return l;
  }
  if (opts.customerLocale) return sanitizeLocale(opts.customerLocale, opts.tenantDefault || "en");

  try {
    const { data: domains } = await supabase
      .from("tenant_domains")
      .select("locale, is_active")
      .eq("tenant_id", opts.tenantId);
    if (domains?.length === 1 && domains[0].locale) {
      return sanitizeLocale(domains[0].locale, opts.tenantDefault || "en");
    }
  } catch (_e) {
    // ignore
  }

  const c = (opts.countryCode || "").toUpperCase();
  if (["NL", "BE"].includes(c)) return "nl";
  if (["FR", "LU", "CH", "MC"].includes(c)) return "fr";
  if (["DE", "AT"].includes(c)) return "de";
  return opts.tenantDefault || "en";
}

export { escapeHtml as escTenant } from "./_tenantEmailEsc.ts";
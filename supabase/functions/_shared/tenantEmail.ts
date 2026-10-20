// Stream B (Tenant → Customer) shared email util.
//
// Parallel to `_shared/sellqoEmail.ts`, this module renders tenant-branded
// HTML emails using the same `emailBaseLayout` skeleton, but injects per-tenant
// colors, logo, fonts and footer branding pulled from `tenants` +
// `tenant_theme_settings`.
//
// Edge cases handled:
//   • Missing tenant_theme_settings row → SellQo defaults
//   • Missing or malformed logo_url → logoUrl/emailLogoUrl null; de kop toont dan de
//     winkelnaam als tekst (MAIL-LOGO-1). Nooit het SellQo-logo in de mail van een winkel;
//     enkel de facturatietenant (slug `sellqo`, de eigen mails van SellQo) valt erop terug.
//   • Malformed hex (e.g. 'red', '#zzz') → sanitized to default
//   • Missing locale → falls back via getTenantLocale() to 'en'
//
// All Stream B sender addresses live in `_shared/emailSenders.ts`; this
// module is purely visual/templating.

import { resolveCustomerContactEmail } from "./customerContact.ts";
import type { TenantSenderSource } from "./emailSenders.ts";
import { readableTextColor } from "./colorContrast.ts";
import { BILLING_TENANT_SLUG } from "./billingTenant.ts";
import { shopHomeUrlFor } from "./storefrontUrls.ts";
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
  /**
   * MAIL-LOGO-1: het eigen logo van de winkel (origineel, zoals in de storefront), of null.
   * Vroeger viel dit terug op het SellQo-logo; dat staat nooit meer in de mail van een winkel.
   */
  logoUrl: string | null;
  /**
   * MAIL-LOGO-1: het logo voor mails — de e-mailvariant (`tenants.email_logo_url`, bijgesneden,
   * 176 px hoog, PNG) als die bij het huidige logo hoort, anders het origineel, anders null.
   */
  emailLogoUrl: string | null;
  /**
   * MAIL-LOGO-1: de homepage van de winkel (`storefrontUrls.shopHomeUrlFor`), of null.
   * Link onder het logo en bron van `resolveShopUrl` ({{shop_url}}).
   */
  shopUrl: string | null;
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
  /**
   * MAIL-SENDER-1: wat `tenantSender` nodig heeft om From en Reply-To te bouwen
   * (`_shared/emailSenders.ts`). Zo hoeft een brand-caller niets extra op te halen.
   */
  senderSource: TenantSenderSource;
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

function sanitizeUrl(input: unknown): string | null {
  const v = typeof input === "string" ? input.trim() : "";
  return URL_RE.test(v) && !/[\s"'<>]/.test(v) ? v : null;
}

/**
 * MAIL-LOGO-1: welk logo de mail toont. De e-mailvariant telt alleen als ze gemaakt is van het
 * logo dat nu geldt (`email_logo_source_url`): wie later een ander logo uploadt of het logo
 * weghaalt, krijgt nooit een verouderde variant. Puur, zodat de test hem rechtstreeks gebruikt.
 */
export function pickEmailLogo(opts: {
  themeLogo?: unknown;
  tenantLogo?: unknown;
  emailLogo?: unknown;
  emailLogoSource?: unknown;
  isBillingTenant?: boolean;
}): { logoUrl: string | null; emailLogoUrl: string | null } {
  const raw = (typeof opts.themeLogo === "string" && opts.themeLogo.trim())
    || (typeof opts.tenantLogo === "string" && opts.tenantLogo.trim()) || "";
  const own = sanitizeUrl(raw);
  if (!own) {
    // De eigen mails van SellQo (facturatietenant) houden het SellQo-logo, zoals vroeger.
    return opts.isBillingTenant ? { logoUrl: LOGO_URL, emailLogoUrl: LOGO_URL } : { logoUrl: null, emailLogoUrl: null };
  }
  const variant = sanitizeUrl(opts.emailLogo);
  const source = typeof opts.emailLogoSource === "string" ? opts.emailLogoSource.trim() : "";
  return { logoUrl: own, emailLogoUrl: variant && source === raw ? variant : own };
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
  let emailLogoRow: { email_logo_url?: unknown; email_logo_source_url?: unknown } | null = null;
  let canonicalDomain: string | null = null;
  let themeFailed = false;

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, name, slug, inbound_email_prefix, billing_company_name, support_email, owner_email, primary_color, logo_url, custom_domain, product_url_template, address, city, postal_code, country, btw_number, billing_vat_number, language",
      )
      .eq("id", tenantId)
      .maybeSingle();
    if (error) {
      console.error("[tenantEmail] tenants select failed", { tenantId, error });
    }
    tenantRow = data || null;
  } catch (e) {
    console.error("[tenantEmail] tenants select threw", { tenantId, error: String(e) });
    tenantRow = null;
  }

  try {
    const { data, error } = await supabase
      .from("tenant_theme_settings")
      .select(
        "logo_url, primary_color, secondary_color, accent_color, background_color, text_color, brand_color, theme_mode, heading_font, body_font, use_custom_frontend",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) {
      console.error("[tenantEmail] tenant_theme_settings select failed", { tenantId, error });
      themeFailed = true;
    }
    themeRow = data || null;
  } catch (e) {
    console.error("[tenantEmail] tenant_theme_settings select threw", { tenantId, error: String(e) });
    themeRow = null;
    themeFailed = true;
  }

  // MAIL-LOGO-1: de e-mailvariant apart lezen. Faalt deze select (migratie nog niet gedraaid),
  // dan valt enkel de variant weg en blijft de rest van het merk intact.
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("email_logo_url, email_logo_source_url")
      .eq("id", tenantId)
      .maybeSingle();
    if (error) console.warn("[tenantEmail] email_logo select failed", { tenantId, error });
    emailLogoRow = data || null;
  } catch (e) {
    console.warn("[tenantEmail] email_logo select threw", { tenantId, error: String(e) });
  }

  // MAIL-LOGO-1: zelfde canonieke-domeinquery als resolveShopUrl vroeger deed.
  try {
    const { data } = await supabase
      .from("tenant_domains").select("domain")
      .eq("tenant_id", tenantId).eq("is_active", true).eq("dns_verified", true).eq("is_canonical", true)
      .limit(1).maybeSingle();
    canonicalDomain = typeof data?.domain === "string" ? data.domain : null;
  } catch (_e) { /* geen canoniek domein */ }

  const t = tenantRow || {};
  const th = themeRow || {};
  const isBillingTenant = t.slug === BILLING_TENANT_SLUG;
  const logos = pickEmailLogo({
    themeLogo: th.logo_url,
    tenantLogo: t.logo_url,
    emailLogo: emailLogoRow?.email_logo_url,
    emailLogoSource: emailLogoRow?.email_logo_source_url,
    isBillingTenant,
  });
  // De facturatietenant (SellQo zelf) linkt naar sellqo.app, zoals zijn mails altijd deden.
  const shopUrl = isBillingTenant ? "https://sellqo.app" : shopHomeUrlFor({
    customDomain: typeof t.custom_domain === "string" ? t.custom_domain : null,
    canonicalDomain,
    productUrlTemplate: typeof t.product_url_template === "string" ? t.product_url_template : null,
    // Kon de themarij niet gelezen worden, dan weten we niet of de winkel een eigen frontend
    // heeft: voorzichtig, dus geen sellqo.shop-adres. Geen rij = SellQo-theme (zoals vroeger).
    useCustomFrontend: themeFailed || th.use_custom_frontend === true,
    slug: typeof t.slug === "string" ? t.slug : null,
  });

  // MAIL-CONTACT-1: één bron. notification_email hoort hier niet in — dat is
  // het adres voor de eigen meldingen van de winkel, en het lekte via deze keten
  // naar klanten.
  const supportEmail = resolveCustomerContactEmail(t);

  const customDomain = (t.custom_domain && String(t.custom_domain).trim()) || "";
  const websiteUrl = customDomain
    ? (URL_RE.test(customDomain) ? customDomain : `https://${customDomain.replace(/^\/+/, "")}`)
    : undefined;

  return {
    tenantId,
    tenantName: (t.name && String(t.name).trim()) || "SellQo",
    legalName: (t.billing_company_name && String(t.billing_company_name).trim()) || undefined,
    logoUrl: logos.logoUrl,
    emailLogoUrl: logos.emailLogoUrl,
    shopUrl,
    primaryColor: sanitizeColor(th.primary_color || t.primary_color, BRAND.primary),
    accentColor: sanitizeColor(th.accent_color, BRAND.accent),
    // MAIL-THEME-1: de tekstkleur van het storefront-thema staat hier op de
    // vaste witte card. Bij een donker thema is die licht (VanXcel #f0f0f0,
    // Astra Sleep #f5f5f5) en werd de mail onleesbaar. Alleen overnemen als het
    // contrast met de card WCAG AA haalt (4.5:1).
    textColor: readableTextColor(sanitizeColor(th.text_color, BRAND.text), BRAND.card, BRAND.text),
    mutedColor: BRAND.muted,
    backgroundColor: sanitizeColor(th.background_color, BRAND.bg),
    cardColor: BRAND.card,
    borderColor: BRAND.border,
    brandColor: sanitizeColor(th.brand_color || th.primary_color || t.primary_color, BRAND.primary),
    themeMode: th.theme_mode === "dark" ? "dark" : "light",
    headingFont: (typeof th.heading_font === "string" && th.heading_font) || "Inter",
    bodyFont: (typeof th.body_font === "string" && th.body_font) || "Inter",
    supportEmail,
    senderSource: {
      name: (t.name && String(t.name).trim()) || "SellQo",
      inbound_email_prefix: t.inbound_email_prefix ?? null,
      slug: t.slug ?? null,
      support_email: t.support_email ?? null,
    },
    websiteUrl,
    address: (t.address && String(t.address).trim()) || undefined,
    city: (t.city && String(t.city).trim()) || undefined,
    postalCode: (t.postal_code && String(t.postal_code).trim()) || undefined,
    country: (t.country && String(t.country).trim()) || undefined,
    vatNumber: (t.btw_number || t.billing_vat_number)
      ? String(t.btw_number || t.billing_vat_number).trim()
      : undefined,
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
  /**
   * MAIL-REPLY-FORMAT-1: optioneel. Ontbreekt hij (undefined), dan geen <h1> —
   * voor een 1-op-1-bericht uit de inbox. Een lege string rendert nog steeds een
   * (lege) <h1>, zoals vroeger: zo blijft elke bestaande mail byte-gelijk.
   */
  heading?: string;
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
  // BUILD-GREEN-1: hier stond `${BRAND.primary === "" ? "" : ""}` — altijd "", dus weggelaten; uitvoer gelijk.
  const headingFont = `${b.headingFont}, -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;
  const bodyFont = `${b.bodyFont}, -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;

  // Header with tenant logo. MAIL-SENDER-1: het logo staat op een eigen wit vlak.
  // Het stond rechtstreeks op de achtergrond van het thema (VanXcel #0f0f0f) en in
  // dark mode op #0f172a — een zwart logo was dan onzichtbaar. `.sq-logo` blijft
  // wit in de dark-mode-query van emailBaseLayout (sellqoEmail.ts).
  const header = renderTenantEmailHeader(b);

  const primaryBtn = opts.primaryCta
    ? renderBrandedButton(opts.primaryCta.label, opts.primaryCta.url, b.primaryColor, pickFg(b.primaryColor))
    : "";
  const secondaryBtn = opts.secondaryCta
    ? `<div style="margin-top:12px;">${renderBrandedButton(opts.secondaryCta.label, opts.secondaryCta.url, "#ffffff", b.primaryColor, b.primaryColor)}</div>`
    : "";

  const content = `<tr><td class="sq-card" style="background-color:${b.cardColor};border:1px solid ${b.borderColor};border-radius:12px;padding:40px;font-family:${bodyFont};color:${b.textColor};">
    ${opts.heading !== undefined ? `<h1 style="margin:0 0 16px;font-family:${headingFont};font-size:22px;line-height:1.3;font-weight:700;color:${b.textColor};">${esc(opts.heading)}</h1>` : ""}
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

/**
 * MAIL-LOGO-1 — kop van elke tenantmail. Het logo (of de naam) staat op een eigen wit vlak
 * (MAIL-SENDER-1): het stond rechtstreeks op de achtergrond van het thema (VanXcel #0f0f0f) en in
 * dark mode op #0f172a — een zwart logo was dan onzichtbaar. `.sq-logo` blijft wit in de
 * dark-mode-query van emailBaseLayout (sellqoEmail.ts).
 *
 *   • Logo: de e-mailvariant (emailLogoUrl), 44 px hoog getoond (variant is 176 px = 4x).
 *   • Geen logo: de winkelnaam als tekst, kopfont, primaire kleur (enkel als die op wit leesbaar
 *     is, anders de standaard tekstkleur). Nooit het SellQo-logo.
 *   • Link: de echte homepage (shopUrl). Geen adres → geen link, nooit sellqo.app.
 */
export function renderTenantEmailHeader(b: TenantBrand): string {
  const headingFont = `${b.headingFont}, -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;
  const nameColor = readableTextColor(b.primaryColor, "#ffffff", BRAND.text, 3);
  const inner = b.emailLogoUrl
    ? `<img src="${esc(b.emailLogoUrl)}" alt="${esc(b.tenantName)}" height="44" style="height:44px;width:auto;display:block;border:0;outline:none;margin:0 auto;" />`
    : `<span class="sq-logo-name" style="display:block;font-family:${esc(headingFont)};font-size:22px;line-height:28px;font-weight:700;color:${nameColor};padding:8px 0;text-align:center;">${esc(b.tenantName)}</span>`;
  const linked = b.shopUrl
    ? `<a href="${esc(b.shopUrl)}" target="_blank" style="text-decoration:none;color:${nameColor};">${inner}</a>`
    : inner;
  return `<tr><td align="center" style="padding:0 0 24px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr>
      <td class="sq-logo" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:10px;padding:12px 20px;">
        ${linked}
      </td>
    </tr></table>
  </td></tr>`;
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
    const raw = String(opts.explicit || "").toLowerCase().slice(0, 2);
    if (SUPPORTED_LOCALES.includes(raw as TenantLocale)) return raw as TenantLocale;
    // niet-ondersteunde explicit locale → val door naar de rest van de keten
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

export { esc as escTenant };
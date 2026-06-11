// Shared SellQo email design-system helper.
// Use for platform/system emails (team invites, password reset, billing, etc.)
// AND as building blocks for tenant-branded Stream B emails.
//
// Architecture:
//   - BRAND: design tokens (color palette)
//   - emailHeader / emailFooter / emailButton / emailInfoBox / emailDivider /
//     emailTable / emailAddressBlock / emailHeading / emailParagraph: building blocks
//   - emailBaseLayout: wraps content + footer in full <html> with dark-mode support
//   - renderSellqoEmail: convenience helper with SellQo defaults (back-compat)
//   - htmlToPlainText: plain-text fallback for Resend `text` field

export const BRAND = {
  primary: "#1d3a5f", // hsl(212, 52%, 24%)
  primaryDark: "#142a45",
  accent: "#ff7733",  // hsl(16, 100%, 60%)
  text: "#1a2332",
  muted: "#5b6b7d",
  border: "#e4e8ee",
  bg: "#f4f6f9",
  card: "#ffffff",
  footerText: "#8a96a4",
} as const;

export type BrandTokens = typeof BRAND;

export const LOGO_URL = "https://sellqo.app/email-logo.png";

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// ─────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────

/** Header with logo + optional tenant name underline. */
export function emailHeader(opts: { logo?: string; tenantName?: string } = {}): string {
  const logo = opts.logo || LOGO_URL;
  return `
  <tr>
    <td align="center" style="padding:8px 0 28px;text-align:center;">
      <a href="https://sellqo.app" target="_blank" style="text-decoration:none;color:${BRAND.primary};">
        <img src="${logo}" alt="${opts.tenantName ? escapeAttr(opts.tenantName) : "SellQo"}" height="40" style="height:40px;width:auto;max-width:200px;display:inline-block;border:0;outline:none;text-decoration:none;vertical-align:middle;" />
      </a>
      ${opts.tenantName ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:13px;color:${BRAND.muted};">${escapeHtml(opts.tenantName)}</p>` : ""}
    </td>
  </tr>`;
}

/** Standard footer with legal, optional unsubscribe + extra links. */
export function emailFooter(opts: {
  legal?: string;
  unsubscribeUrl?: string;
  extraLinks?: { label: string; url: string }[];
  supportEmail?: string;
  prependNote?: string;
  /** Optional alignment override. Default: left. */
  align?: "left" | "center";
}): string {
  const legal = opts.legal || `© ${new Date().getFullYear()} SellQo. Alle rechten voorbehouden.`;
  const supportEmail = opts.supportEmail || "support@sellqo.app";
  const align = opts.align || "left";
  const links: string[] = [];
  if (opts.extraLinks?.length) {
    for (const l of opts.extraLinks) {
      links.push(`<a href="${escapeAttr(l.url)}" style="color:${BRAND.footerText};text-decoration:underline;">${escapeHtml(l.label)}</a>`);
    }
  }
  if (opts.unsubscribeUrl) {
    links.push(`<a href="${escapeAttr(opts.unsubscribeUrl)}" style="color:${BRAND.footerText};text-decoration:underline;">Uitschrijven</a>`);
  }

  const prepend = opts.prependNote
    ? `<p style="margin:0 0 12px;font-size:12px;color:${BRAND.footerText};line-height:1.6;text-align:${align};">${opts.prependNote}</p>`
    : "";

  return `
  <tr>
    <td class="sq-footer" align="${align}" style="padding:28px 24px 8px;font-family:${SANS};text-align:${align};">
      ${prepend}
      <p style="margin:0 0 6px;font-size:12px;color:${BRAND.footerText};line-height:1.6;">
        Verzonden door <a href="https://sellqo.app" style="color:${BRAND.footerText};text-decoration:underline;">SellQo</a> &middot; Jouw webshop. Simpel online.
      </p>
      <p style="margin:0 0 6px;font-size:12px;color:${BRAND.footerText};line-height:1.6;">
        Vragen? Mail ons op <a href="mailto:${escapeAttr(supportEmail)}" style="color:${BRAND.footerText};text-decoration:underline;">${escapeHtml(supportEmail)}</a>.
      </p>
      ${links.length ? `<p style="margin:0 0 6px;font-size:12px;color:${BRAND.footerText};line-height:1.6;">${links.join(" &middot; ")}</p>` : ""}
      <p style="margin:8px 0 0;font-size:11px;color:${BRAND.footerText};line-height:1.5;">${escapeHtml(legal)}</p>
    </td>
  </tr>`;
}

/** Bulletproof MSO + non-MSO button. */
export function emailButton(
  label: string,
  url: string,
  variant: "primary" | "secondary" = "primary",
): string {
  const isPrimary = variant === "primary";
  const bg = isPrimary ? BRAND.primary : "#ffffff";
  const fg = isPrimary ? "#ffffff" : BRAND.primary;
  const borderColor = isPrimary ? BRAND.primary : BRAND.border;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 0;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:8px;border:1px solid ${borderColor};">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeAttr(url)}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="${borderColor}" fillcolor="${bg}">
          <w:anchorlock/>
          <center style="color:${fg};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(label)}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${escapeAttr(url)}" target="_blank"
           style="display:inline-block;padding:14px 32px;font-family:${SANS};font-size:15px;font-weight:600;color:${fg};text-decoration:none;border-radius:8px;background-color:${bg};mso-hide:all;">
          ${escapeHtml(label)}
        </a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;
}

const INFO_VARIANTS = {
  info:    { bg: "#f7f9fc", border: BRAND.border,   accent: BRAND.accent },
  success: { bg: "#ecfdf5", border: "#a7f3d0",      accent: "#10b981" },
  warning: { bg: "#fffbeb", border: "#fde68a",      accent: "#f59e0b" },
  danger:  { bg: "#fef2f2", border: "#fecaca",      accent: "#ef4444" },
} as const;

/** Highlighted info box with accent border-left. */
export function emailInfoBox(opts: {
  title: string;
  subtitle?: string;
  variant?: keyof typeof INFO_VARIANTS;
}): string {
  const v = INFO_VARIANTS[opts.variant || "info"];
  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:${v.bg};border:1px solid ${v.border};border-left:3px solid ${v.accent};border-radius:8px;padding:16px 20px;font-family:${SANS};">
        <p style="margin:0;font-size:15px;font-weight:600;color:${BRAND.text};">${escapeHtml(opts.title)}</p>
        ${opts.subtitle ? `<p style="margin:4px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">${escapeHtml(opts.subtitle)}</p>` : ""}
      </td>
    </tr>
  </table>`;
}

/** Horizontal divider. */
export function emailDivider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

/** Table for line-items (orders, invoices). */
export function emailTable(opts: {
  headers?: string[];
  rows: string[][];
  footer?: { label: string; value: string };
}): string {
  const headerHtml = opts.headers?.length
    ? `<thead><tr>${opts.headers
        .map(
          (h, i) =>
            `<th align="${i === opts.headers!.length - 1 ? "right" : "left"}" style="padding:10px 12px;font-family:${SANS};font-size:12px;font-weight:600;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid ${BRAND.border};">${escapeHtml(h)}</th>`,
        )
        .join("")}</tr></thead>`
    : "";

  const bodyHtml = opts.rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td align="${i === r.length - 1 ? "right" : "left"}" style="padding:12px;font-family:${SANS};font-size:14px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};vertical-align:top;">${cell}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const footerHtml = opts.footer
    ? `<tfoot><tr>
        <td colspan="${Math.max(1, (opts.headers?.length || opts.rows[0]?.length || 1) - 1)}" align="right" style="padding:14px 12px;font-family:${SANS};font-size:14px;font-weight:600;color:${BRAND.text};">${escapeHtml(opts.footer.label)}</td>
        <td align="right" style="padding:14px 12px;font-family:${SANS};font-size:15px;font-weight:700;color:${BRAND.text};">${escapeHtml(opts.footer.value)}</td>
      </tr></tfoot>`
    : "";

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;border-collapse:collapse;">${headerHtml}<tbody>${bodyHtml}</tbody>${footerHtml}</table>`;
}

/** Address block for shipping/billing. */
export function emailAddressBlock(addr: {
  name: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
}): string {
  const lines = [
    `<strong>${escapeHtml(addr.name)}</strong>`,
    escapeHtml(addr.line1),
    addr.line2 ? escapeHtml(addr.line2) : "",
    `${escapeHtml(addr.postalCode)} ${escapeHtml(addr.city)}`,
    escapeHtml(addr.country),
  ].filter(Boolean);

  return `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${BRAND.text};">${lines.join("<br/>")}</p>`;
}

/** Consistent heading. */
export function emailHeading(level: 1 | 2 | 3, text: string): string {
  const sizes = { 1: "22px", 2: "18px", 3: "15px" } as const;
  const margins = { 1: "0 0 16px", 2: "24px 0 8px", 3: "20px 0 6px" } as const;
  const tag = `h${level}`;
  return `<${tag} style="margin:${margins[level]};font-family:${SANS};font-size:${sizes[level]};line-height:1.3;font-weight:${level === 1 ? 700 : 600};color:${BRAND.text};">${escapeHtml(text)}</${tag}>`;
}

/** Paragraph helper. */
export function emailParagraph(text: string, opts: { muted?: boolean; raw?: boolean } = {}): string {
  const color = opts.muted ? BRAND.muted : BRAND.text;
  const body = opts.raw ? text : escapeHtml(text);
  return `<p style="margin:0 0 12px;font-family:${SANS};font-size:15px;line-height:1.65;color:${color};">${body}</p>`;
}

// ─────────────────────────────────────────────────────────────────────
// Base layout
// ─────────────────────────────────────────────────────────────────────

export interface BaseLayoutOptions {
  preheader?: string;
  brand?: Partial<BrandTokens>;
  logo?: string;
  /** Pre-rendered <tr>… rows (header, content card, footer). */
  content: string;
  footer: string;
  /** Pre-rendered header <tr>… (defaults to emailHeader). */
  header?: string;
  /** Enable @media (prefers-color-scheme: dark) overrides. Default true. */
  darkMode?: boolean;
  lang?: string;
}

/**
 * Wraps content + footer in a full HTML <html>/<head>/<body> with bulletproof
 * table layout and (by default) prefers-color-scheme dark variants.
 */
export function emailBaseLayout(opts: BaseLayoutOptions): string {
  const brand = { ...BRAND, ...(opts.brand || {}) };
  const header = opts.header ?? emailHeader({ logo: opts.logo });
  const darkMode = opts.darkMode !== false;
  const lang = opts.lang || "nl";

  const darkCss = darkMode
    ? `
    @media (prefers-color-scheme: dark) {
      body, .sq-bg { background-color:#0f172a !important; }
      .sq-card { background-color:#1a2332 !important; border-color:#283449 !important; }
      .sq-card h1, .sq-card h2, .sq-card h3, .sq-card p, .sq-card td { color:#e8edf5 !important; }
      .sq-footer p, .sq-footer a { color:#94a3b8 !important; }
      .sq-muted { color:#94a3b8 !important; }
      .sq-divider { border-color:#283449 !important; }
    }`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeAttr(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>SellQo</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>${darkCss}
    @media only screen and (max-width:600px) {
      .sq-card { padding:24px !important; }
    }
  </style>
</head>
<body class="sq-bg" style="margin:0;padding:0;background-color:${brand.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:${brand.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${opts.preheader ? escapeHtml(opts.preheader) : ""}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="sq-bg" style="background-color:${brand.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
          ${header}
          ${opts.content}
          ${opts.footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────
// Convenience helper (backwards compatible)
// ─────────────────────────────────────────────────────────────────────

export interface SellqoEmailOptions {
  /** Pre-header / inbox preview text (hidden in body). */
  preheader?: string;
  /** Main heading shown at the top of the card. */
  heading: string;
  /** Intro paragraph(s) — raw HTML allowed (already escaped by caller). */
  intro: string;
  /** Optional highlighted info box (e.g. role + description). Supports variants. */
  infoBox?: { title: string; subtitle?: string; variant?: "info" | "success" | "warning" | "danger" };
  /** Primary CTA. */
  cta?: { label: string; url: string };
  /** Optional secondary CTA below primary. */
  secondaryCta?: { label: string; url: string };
  /** Small note under the CTA (e.g. expiry date). */
  ctaNote?: string;
  /** Optional extra footer line above the standard SellQo footer. */
  footerNote?: string;
  /** Override reply-to / support address shown in footer. */
  supportEmail?: string;
  /** Optional unsubscribe URL (omit for non-marketing). */
  unsubscribeUrl?: string;
  /** Toggle dark-mode CSS. Default true. */
  darkMode?: boolean;
}

/**
 * Builds a bulletproof, table-based, fully inline-styled HTML email
 * with consistent SellQo branding. Renders well in Outlook + Gmail.
 * Backwards compatible with all earlier callers.
 */
export function renderSellqoEmail(opts: SellqoEmailOptions): string {
  const {
    preheader = "",
    heading,
    intro,
    infoBox,
    cta,
    secondaryCta,
    ctaNote,
    footerNote,
    supportEmail,
    unsubscribeUrl,
    darkMode,
  } = opts;

  const ctaHtml = cta ? emailButton(cta.label, cta.url, "primary") : "";
  const secondaryHtml = secondaryCta
    ? `<div style="margin-top:12px;">${emailButton(secondaryCta.label, secondaryCta.url, "secondary")}</div>`
    : "";
  const infoBoxHtml = infoBox ? emailInfoBox(infoBox) : "";
  const ctaNoteHtml = ctaNote
    ? `<p class="sq-muted" style="margin:20px 0 0;font-family:${SANS};font-size:13px;color:${BRAND.muted};text-align:center;line-height:1.6;">${ctaNote}</p>`
    : "";

  // Airy auth-mail style: transparent card, centered heading, generous whitespace.
  // Keeps `sq-card` class so existing dark-mode CSS still applies.
  const content = `
  <tr>
    <td class="sq-card" style="background-color:#ffffff;padding:8px 32px 32px;">
      <h1 style="margin:0 0 20px;font-family:${SANS};font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.text};text-align:center;">
        ${heading}
      </h1>
      <div style="font-family:${SANS};font-size:15px;line-height:1.65;color:${BRAND.text};text-align:center;">
        ${intro}
      </div>
      ${infoBoxHtml}
      <div style="text-align:center;margin-top:8px;">${ctaHtml}</div>
      ${secondaryHtml ? `<div style="text-align:center;">${secondaryHtml}</div>` : ""}
      ${ctaNoteHtml}
    </td>
  </tr>`;

  const footer = emailFooter({
    supportEmail,
    unsubscribeUrl,
    prependNote: footerNote,
    align: "center",
  });

  return emailBaseLayout({
    preheader,
    content,
    footer,
    darkMode,
    // Airy white canvas — only applies to Stream A; Stream B passes its own brand.
    brand: { bg: "#ffffff" },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Plain-text fallback
// ─────────────────────────────────────────────────────────────────────

/** Strips HTML to a readable plain-text fallback for the Resend `text` field. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
// Shared SellQo system-email layout helper.
// Use for platform/system emails (team invites, password reset, billing, etc.).
// NOT for tenant-branded storefront/customer emails.

const BRAND = {
  primary: "#1d3a5f", // hsl(212, 52%, 24%)
  primaryDark: "#142a45",
  text: "#1a2332",
  muted: "#5b6b7d",
  border: "#e4e8ee",
  bg: "#f4f6f9",
  card: "#ffffff",
  footerText: "#8a96a4",
};

export interface SellqoEmailOptions {
  /** Pre-header / inbox preview text (hidden in body). */
  preheader?: string;
  /** Main heading shown at the top of the card. */
  heading: string;
  /** Intro paragraph(s) — raw HTML allowed (already escaped by caller). */
  intro: string;
  /** Optional highlighted info box (e.g. role + description). */
  infoBox?: { title: string; subtitle?: string };
  /** Primary CTA. */
  cta?: { label: string; url: string };
  /** Small note under the CTA (e.g. expiry date). */
  ctaNote?: string;
  /** Optional extra footer line above the standard SellQo footer. */
  footerNote?: string;
}

/**
 * Builds a bulletproof, table-based, fully inline-styled HTML email
 * with consistent SellQo branding. Renders well in Outlook + Gmail.
 */
export function renderSellqoEmail(opts: SellqoEmailOptions): string {
  const {
    preheader = "",
    heading,
    intro,
    infoBox,
    cta,
    ctaNote,
    footerNote,
  } = opts;

  const ctaHtml = cta
    ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.primary}" style="border-radius:8px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${cta.url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" stroke="f" fillcolor="${BRAND.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${cta.label}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${cta.url}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${BRAND.primary};mso-hide:all;">
            ${cta.label}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`
    : "";

  const infoBoxHtml = infoBox
    ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="background-color:#f7f9fc;border:1px solid ${BRAND.border};border-radius:8px;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:15px;font-weight:600;color:${BRAND.text};">${infoBox.title}</p>
          ${infoBox.subtitle ? `<p style="margin:4px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">${infoBox.subtitle}</p>` : ""}
        </td>
      </tr>
    </table>`
    : "";

  const ctaNoteHtml = ctaNote
    ? `<p style="margin:20px 0 0;font-size:13px;color:${BRAND.muted};text-align:center;line-height:1.6;">${ctaNote}</p>`
    : "";

  const footerNoteHtml = footerNote
    ? `<p style="margin:0 0 12px;font-size:12px;color:${BRAND.footerText};line-height:1.6;">${footerNote}</p>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="nl">
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
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <a href="https://sellqo.app" target="_blank" style="text-decoration:none;color:${BRAND.primary};">
                <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:${BRAND.primary};">SellQo</span>
              </a>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;padding:40px;">
              <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.text};">
                ${heading}
              </h1>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.text};">
                ${intro}
              </div>
              ${infoBoxHtml}
              ${ctaHtml}
              ${ctaNoteHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 24px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              ${footerNoteHtml}
              <p style="margin:0 0 6px;font-size:12px;color:${BRAND.footerText};line-height:1.6;">
                Verzonden door <a href="https://sellqo.app" style="color:${BRAND.footerText};text-decoration:underline;">SellQo</a> &middot; Jouw webshop. Simpel online.
              </p>
              <p style="margin:0;font-size:12px;color:${BRAND.footerText};line-height:1.6;">
                Vragen? Mail ons op <a href="mailto:support@sellqo.app" style="color:${BRAND.footerText};text-decoration:underline;">support@sellqo.app</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
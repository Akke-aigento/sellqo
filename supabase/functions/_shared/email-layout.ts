// Shared transactional email layout for tenant-branded mails.
// Bulletproof, inline-styled, table-based HTML that survives Outlook/Gmail.
// Reusable for invitations, order confirmations, password resets, etc.

export interface EmailTenantBranding {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  replyTo?: string | null;
}

export interface EmailLayoutOptions {
  tenant: EmailTenantBranding;
  preheader?: string;
  heading: string;
  bodyHtml: string; // already-escaped/safe HTML for the main content block
  cta?: { label: string; url: string };
  footerNote?: string; // optional extra line above the SellQo footer
}

const SELLQO_LOGO = "https://sellqo.app/logo.png"; // fallback brand
const SELLQO_PRIMARY = "#16a34a";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function bulletproofButton(label: string, url: string, color: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  // VML fallback for Outlook + table-based fallback for everything else.
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="${color}" style="border-radius:8px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="16%" stroke="f" fillcolor="${color}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${safeLabel}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${safeUrl}"
             style="background-color:${color};border-radius:8px;color:#ffffff;display:inline-block;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;
                    font-weight:600;line-height:48px;text-align:center;text-decoration:none;
                    padding:0 32px;mso-hide:all;">
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const primary = (opts.tenant.primaryColor && /^#?[0-9a-fA-F]{6}$/.test(opts.tenant.primaryColor.replace('#','')))
    ? (opts.tenant.primaryColor.startsWith('#') ? opts.tenant.primaryColor : `#${opts.tenant.primaryColor}`)
    : SELLQO_PRIMARY;

  const tenantName = escapeHtml(opts.tenant.name || 'SellQo');
  const logo = opts.tenant.logoUrl || SELLQO_LOGO;
  const header = opts.tenant.logoUrl
    ? `<img src="${escapeHtml(logo)}" alt="${tenantName}" width="140" style="max-width:140px;height:auto;display:block;border:0;outline:none;" />`
    : `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;">${tenantName}</div>`;

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;">${escapeHtml(opts.preheader)}</div>`
    : '';

  const cta = opts.cta ? bulletproofButton(opts.cta.label, opts.cta.url, primary) : '';

  const footerNote = opts.footerNote
    ? `<p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(opts.footerNote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-font-smoothing:antialiased;">
  ${preheader}
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;
                      box-shadow:0 1px 3px rgba(15,23,42,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;border-bottom:1px solid #e2e8f0;">
              ${header}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 24px;">
              <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                         font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;">
                ${escapeHtml(opts.heading)}
              </h1>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                          font-size:15px;line-height:1.6;color:#334155;">
                ${opts.bodyHtml}
              </div>
              ${cta ? `<div style="padding:28px 0 8px;text-align:center;">${cta}</div>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
              ${footerNote}
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Verzonden via <a href="https://sellqo.app" style="color:#94a3b8;text-decoration:underline;">SellQo</a>
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

/** Convert a simple HTML body into a plain-text fallback (for deliverability). */
export function htmlToPlainText(input: string): string {
  return input
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
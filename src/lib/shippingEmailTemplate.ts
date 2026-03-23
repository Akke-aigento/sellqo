// Coolblue-style shipping email body generator
// Used by useOrderShipping.ts (frontend) — edge functions have an inline copy

export interface ShippingEmailParams {
  orderNumber: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  primaryColor?: string;
}

export function generateShippingEmailHtml({
  orderNumber,
  carrierName,
  trackingNumber,
  trackingUrl,
  primaryColor = '#7c3aed',
}: ShippingEmailParams): string {
  const stepDot = (active: boolean) =>
    active
      ? `display:inline-block;width:12px;height:12px;border-radius:50%;background:${primaryColor};vertical-align:middle;`
      : `display:inline-block;width:12px;height:12px;border-radius:50%;background:#d1d5db;vertical-align:middle;`;

  const stepLabel = (active: boolean) =>
    `font-size:12px;color:${active ? '#111827' : '#9ca3af'};font-weight:${active ? '600' : '400'};`;

  return `
    <!-- Hero -->
    <div style="text-align:center;padding:32px 24px 16px;">
      <div style="font-size:40px;line-height:1;">🎉</div>
      <h1 style="margin:12px 0 4px;font-size:24px;font-weight:700;color:#111827;">
        Joepie! Je pakket is onderweg!
      </h1>
      <p style="margin:0;font-size:15px;color:#6b7280;">
        Bestelling <strong>#${orderNumber}</strong> is verzonden
      </p>
    </div>

    <!-- Progress bar -->
    <div style="padding:8px 24px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="text-align:center;width:25%;"><span style="${stepDot(true)}">&nbsp;</span></td>
          <td style="text-align:center;width:25%;"><span style="${stepDot(true)}">&nbsp;</span></td>
          <td style="text-align:center;width:25%;"><span style="${stepDot(false)}">&nbsp;</span></td>
          <td style="text-align:center;width:25%;"><span style="${stepDot(false)}">&nbsp;</span></td>
        </tr>
        <tr>
          <td style="padding-top:6px;text-align:center;"><span style="${stepLabel(true)}">Besteld</span></td>
          <td style="padding-top:6px;text-align:center;"><span style="${stepLabel(true)}">Verzonden</span></td>
          <td style="padding-top:6px;text-align:center;"><span style="${stepLabel(false)}">Onderweg</span></td>
          <td style="padding-top:6px;text-align:center;"><span style="${stepLabel(false)}">Bezorgd</span></td>
        </tr>
        <!-- connecting line -->
        <tr>
          <td colspan="4" style="padding-top:4px;">
            <div style="height:4px;border-radius:2px;background:linear-gradient(90deg,${primaryColor} 0%,${primaryColor} 40%,#e5e7eb 40%,#e5e7eb 100%);"></div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Tracking card -->
    <div style="padding:0 24px 16px;">
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:#f9fafb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <span style="font-size:24px;margin-right:8px;">🚚</span>
            </td>
            <td style="vertical-align:middle;width:100%;">
              <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${carrierName}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
                Tracknummer: <span style="font-family:monospace;font-weight:500;color:#374151;">${trackingNumber}</span>
              </p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- CTA Button -->
    ${trackingUrl ? `
    <div style="padding:8px 24px 24px;text-align:center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="background:${primaryColor};border-radius:12px;">
            <a href="${trackingUrl}" style="display:inline-block;padding:16px 40px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;letter-spacing:0.3px;">
              📦&nbsp; Volg je pakket →
            </a>
          </td>
        </tr>
      </table>
    </div>
    ` : ''}

    <!-- Tip -->
    <div style="padding:0 24px 24px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
        <p style="margin:0;font-size:14px;color:#92400e;">
          💡 <strong>Tip:</strong> Houd je brievenbus in de gaten — het komt eraan!
        </p>
      </div>
    </div>

    <!-- Order reference -->
    <div style="text-align:center;padding:0 24px 8px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        📦 Betreft bestelling: <strong>#${orderNumber}</strong>
      </p>
    </div>
  `;
}

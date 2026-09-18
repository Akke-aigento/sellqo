// MAIL-SENDER-1 — het contactformulier van een webshop doorsturen naar de winkel.
//
// Deze mail gaat naar de winkel zelf, niet naar een klant. Daarom wijkt hij af
// van de gewone winkelmail (tenantSender): From is wel het SellQo-adres van de
// winkel, maar Reply-To is altijd de bezoeker die het formulier invulde — op
// "antwoorden" klikken moet bij die bezoeker uitkomen, nooit bij het eigen
// supportadres van de winkel.
//
// Puur: importeert alleen emailSenders.ts, zodat src/test/contactFormForward.test.ts
// dit rechtstreeks laadt.

import { tenantSender, type TenantSenderSource } from "./emailSenders.ts";

export interface ContactFormForwardInput {
  tenant: TenantSenderSource;
  forwardAddress: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html: string;
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildContactFormForward(input: ContactFormForwardInput): ResendEmailPayload {
  const tenantName = input.tenant.name || "je";
  // Invoer van een bezoeker: escapen. Voorheen ging die ongefilterd de HTML in.
  const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #333;">Nieuw contactformulier bericht</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 8px 0; color: #666; width: 100px;"><strong>Van:</strong></td><td>${esc(input.senderName)} (${esc(input.senderEmail)})</td></tr>
          <tr><td style="padding: 8px 0; color: #666;"><strong>Onderwerp:</strong></td><td>${esc(input.subject)}</td></tr>
        </table>
        <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${esc(input.message)}</div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Dit bericht is doorgestuurd vanuit de ${esc(tenantName)} webshop via SellQo.</p>
      </div>
    `;
  return {
    from: tenantSender(input.tenant).from,
    to: [input.forwardAddress],
    reply_to: input.senderEmail,
    subject: `[Contact] ${input.subject}`,
    html,
  };
}

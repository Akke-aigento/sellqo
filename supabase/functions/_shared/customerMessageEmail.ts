// MAIL-REPLY-FORMAT-1 — de mail van send-customer-message, in twee vormen.
//
// `standard` (standaard): zoals sinds jaar en dag — onderwerp als kop, aanhef
//   "Beste {naam}," en een afsluiting met de winkelnaam. De verzendmeldingen
//   (useOrderShipping, fulfillment-api, tracking-webhook, printful-webhook) en
//   CustomerMessageDialog leunen daarop: hun teksten hebben zelf geen aanhef of groet.
// `inbox`: een 1-op-1-bericht uit de inbox. De tekst van de gebruiker ís de mail —
//   geen kop, geen automatische aanhef, geen tweede groet. Tot 29-09 kreeg zo'n
//   antwoord "Beste administratie@vanempel.nl," en twee afsluitingen.
//
// Huisstijl (logo-chip, kaart, footer, "Je kunt direct antwoorden…") blijft in
// beide vormen. Puur: gedeeld met vitest.

import { renderTenantEmail, type TenantBrand } from "./tenantEmail.ts";
import { t } from "./tenantEmailI18n.ts";

export type CustomerMessageLayout = "standard" | "inbox";

/** Alleen de exacte waarde "inbox" kiest de nieuwe vorm; al het andere is de huidige. */
export function customerMessageLayout(value: unknown): CustomerMessageLayout {
  return value === "inbox" ? "inbox" : "standard";
}

export interface CustomerMessageEmailInput {
  brand: TenantBrand;
  subject: string;
  bodyHtml: string;
  customerName?: string | null;
  contextType?: string | null;
  contextData?: Record<string, unknown> | null;
  replyToEmail: string;
  layout: CustomerMessageLayout;
}

export function buildCustomerMessageEmail(input: CustomerMessageEmailInput): { html: string; text: string } {
  const { brand, subject, layout } = input;
  const locale = brand.defaultLocale;
  const fromName = brand.tenantName;
  const contextData = input.contextData ?? {};
  const contextType = input.contextType;

  const contextBlock = contextType === 'order' && contextData?.order_number
    ? `<div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;font-size:14px;color:#6b7280;">📦 Betreft bestelling: <strong style="color:#111827;">${String(contextData.order_number)}</strong></div>`
    : contextType === 'quote' && contextData?.quote_number
    ? `<div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;font-size:14px;color:#6b7280;">📄 Betreft offerte: <strong style="color:#111827;">${String(contextData.quote_number)}</strong></div>`
    : "";

  const footerNote = `Je kunt direct antwoorden op deze email. Je antwoord gaat naar ${input.replyToEmail}.`;
  const poweredByLabel = t(locale, 'message.poweredBy');

  if (layout === "inbox") {
    return renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: subject,
      // Geen `heading`: renderTenantEmail laat de <h1> dan weg.
      intro: input.bodyHtml,
      content: contextBlock,
      footerNote,
      poweredByLabel,
    });
  }

  return renderTenantEmail({
    tenantBrand: brand,
    locale,
    preheader: subject,
    heading: subject,
    intro: `<p style="margin:0 0 16px;">${t(locale, 'message.greeting', { customerName: input.customerName || 'klant' })}</p><div style="font-size:15px;line-height:1.65;">${input.bodyHtml}</div>`,
    content: `${contextBlock}<p style="margin:32px 0 0;font-size:15px;">${t(locale, 'message.regards')},<br/><strong>${fromName}</strong></p>`,
    footerNote,
    poweredByLabel,
  });
}

// MAIL-1b — bevestigingsmail voor double opt-in, voor newsletter-invite.
//
// Bewust een KOPIE van `_sendNewsletterConfirmation` + NEWSLETTER_CONFIRM_STRINGS
// uit storefront-api (r. ±5029 en ±5187), niet verhuisd: storefront-api bedient de
// zes custom frontends en blijft in deze batch byte-gelijk (eerste wet). Pas je de
// tekst aan, doe het dan op beide plekken, of verhuis storefront-api in een aparte
// batch naar deze module.
//
// De mail is een eenmalige bevestigingsvraag, dus afzender `tenantSender` en geen
// List-Unsubscribe: er is nog geen inschrijving om je van uit te schrijven. Zonder
// klik wordt niemand ingeschreven.
//
// Twee teksten:
//   - NEWSLETTER_CONFIRM_STRINGS: de persoon schreef zich zelf in (webshop).
//   - NEWSLETTER_INVITE_STRINGS: de winkel nodigde het adres uit (newsletter-invite).
//     Die tekst mag niet doen alsof de persoon zich inschreef, en zegt uitdrukkelijk
//     dat niets doen betekent dat je niets ontvangt.
// Uitnodigingen gaan enkel weg als de maandlimiet voor marketingmails nog ruimte
// heeft (gecontroleerd in marketing_prepare_invites), maar tellen niet op in dat
// verbruik.

import { renderTenantEmail, type TenantBrand, type TenantLocale } from "./tenantEmail.ts";
import { tenantSender } from "./emailSenders.ts";
import { escapeHtml } from "./marketingToken.ts";

type ConfirmStrings = { subject: string; heading: string; intro: string; cta: string; note: string };

export const NEWSLETTER_CONFIRM_STRINGS: Record<TenantLocale, ConfirmStrings> = {
  nl: {
    subject: "Bevestig je inschrijving bij {shop}",
    heading: "Bevestig je inschrijving",
    intro: "Bedankt voor je interesse in de nieuwsbrief van {shop}. Klik op de knop hieronder om je inschrijving te bevestigen.",
    cta: "Inschrijving bevestigen",
    note: "Heb je je niet ingeschreven? Dan hoef je niets te doen: zonder bevestiging ontvang je geen nieuwsbrief.",
  },
  en: {
    subject: "Confirm your subscription to {shop}",
    heading: "Confirm your subscription",
    intro: "Thanks for your interest in the {shop} newsletter. Click the button below to confirm your subscription.",
    cta: "Confirm subscription",
    note: "Didn't sign up? Then you don't need to do anything: without confirmation you won't receive our newsletter.",
  },
  fr: {
    subject: "Confirmez votre inscription à {shop}",
    heading: "Confirmez votre inscription",
    intro: "Merci de votre intérêt pour la newsletter de {shop}. Cliquez sur le bouton ci-dessous pour confirmer votre inscription.",
    cta: "Confirmer l'inscription",
    note: "Vous ne vous êtes pas inscrit ? Vous n'avez rien à faire : sans confirmation, vous ne recevrez pas notre newsletter.",
  },
  de: {
    subject: "Bestätige deine Anmeldung bei {shop}",
    heading: "Bestätige deine Anmeldung",
    intro: "Danke für dein Interesse am Newsletter von {shop}. Klicke auf den Button unten, um deine Anmeldung zu bestätigen.",
    cta: "Anmeldung bestätigen",
    note: "Du hast dich nicht angemeldet? Dann musst du nichts tun: ohne Bestätigung erhältst du keinen Newsletter.",
  },
};

export const NEWSLETTER_INVITE_STRINGS: Record<TenantLocale, ConfirmStrings> = {
  nl: {
    subject: "{shop} nodigt je uit voor de nieuwsbrief",
    heading: "Uitnodiging voor de nieuwsbrief",
    intro: "{shop} nodigt je uit voor de nieuwsbrief. Wil je die ontvangen? Bevestig dan hieronder. Doe je niets, dan krijg je niets.",
    cta: "Ja, ik wil de nieuwsbrief",
    note: "Geen interesse? Dan hoef je niets te doen. Zonder bevestiging ontvang je geen nieuwsbrief.",
  },
  en: {
    subject: "{shop} invites you to its newsletter",
    heading: "Newsletter invitation",
    intro: "{shop} invites you to its newsletter. Would you like to receive it? Then confirm below. If you do nothing, you will receive nothing.",
    cta: "Yes, I want the newsletter",
    note: "Not interested? Then you don't need to do anything. Without confirmation you won't receive a newsletter.",
  },
  fr: {
    subject: "{shop} vous invite à sa newsletter",
    heading: "Invitation à la newsletter",
    intro: "{shop} vous invite à sa newsletter. Vous souhaitez la recevoir ? Confirmez ci-dessous. Si vous ne faites rien, vous ne recevrez rien.",
    cta: "Oui, je veux la newsletter",
    note: "Pas intéressé ? Vous n'avez rien à faire. Sans confirmation, vous ne recevrez pas de newsletter.",
  },
  de: {
    subject: "{shop} lädt dich zum Newsletter ein",
    heading: "Einladung zum Newsletter",
    intro: "{shop} lädt dich zum Newsletter ein. Möchtest du ihn erhalten? Dann bestätige unten. Wenn du nichts tust, bekommst du nichts.",
    cta: "Ja, ich möchte den Newsletter",
    note: "Kein Interesse? Dann musst du nichts tun. Ohne Bestätigung erhältst du keinen Newsletter.",
  },
};

export function pickConfirmLocale(language: string | null | undefined, fallback: TenantLocale): TenantLocale {
  const l = String(language || "").toLowerCase().slice(0, 2);
  return (l in NEWSLETTER_CONFIRM_STRINGS ? l : fallback) as TenantLocale;
}

type BuildOpts = {
  brand: TenantBrand;
  tenantId: string;
  email: string;
  token: string;
  locale: TenantLocale;
  supabaseUrl: string;
};
type ResendPayload = { from: string; reply_to?: string; to: string[]; subject: string; html: string; text: string };

/** Bouwt één Resend-payload voor de bevestigingsmail (zelfde opmaak als storefront-api). */
export function buildConfirmationEmail(opts: BuildOpts): ResendPayload {
  return build(opts, NEWSLETTER_CONFIRM_STRINGS);
}

/** Zelfde mail en bevestigingslink, met de uitnodigingstekst (newsletter-invite). */
export function buildInvitationEmail(opts: BuildOpts): ResendPayload {
  return build(opts, NEWSLETTER_INVITE_STRINGS);
}

function build(opts: BuildOpts, table: Record<TenantLocale, ConfirmStrings>): ResendPayload {
  const s = table[opts.locale] || table.nl;
  const fill = (v: string) => v.split("{shop}").join(opts.brand.tenantName);
  const confirmUrl = `${opts.supabaseUrl}/functions/v1/newsletter-confirm?token=${encodeURIComponent(opts.token)}&tenant=${encodeURIComponent(opts.tenantId)}`;
  const { html, text } = renderTenantEmail({
    tenantBrand: opts.brand,
    locale: opts.locale,
    preheader: fill(s.heading),
    heading: fill(s.heading),
    intro: `<p style="margin:0;">${escapeHtml(fill(s.intro))}</p>`,
    primaryCta: { label: s.cta, url: confirmUrl },
    footerNote: escapeHtml(s.note),
  });
  const sender = tenantSender(opts.brand.senderSource);
  return {
    from: sender.from,
    reply_to: sender.replyTo,
    to: [opts.email],
    subject: fill(s.subject).replace(/[\r\n]+/g, " "),
    html,
    text,
  };
}

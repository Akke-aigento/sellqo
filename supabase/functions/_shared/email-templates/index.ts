// Auth-email templates voor Supabase Send-Email Hook.
// Bouwt op _shared/sellqoEmail.ts (string-based building blocks).
// .ts (geen .tsx) — geen React Email, consistent met de bestaande
// SellQo email-stack die HTML-strings produceert.

import { renderSellqoEmail, htmlToPlainText } from "../sellqoEmail.ts";

export type AuthEmailAction =
  | "signup"
  | "login"      // magic link
  | "magiclink"
  | "invite"
  | "recovery"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

export interface AuthEmailContext {
  /** Bv. https://<project>.supabase.co/auth/v1/verify?token=... */
  confirmationUrl: string;
  /** OTP-code voor reauthentication / fallback. */
  token: string;
  /** Site URL (vanuit hook payload). */
  siteUrl: string;
  /** Doel-email. */
  email: string;
  /** Nieuw email-adres bij email_change. */
  newEmail?: string;
}

export interface RenderedAuthEmail {
  subject: string;
  html: string;
  text: string;
}

const supportEmail = "support@sellqo.app";

function render(opts: {
  subject: string;
  preheader: string;
  heading: string;
  intro: string;
  cta?: { label: string; url: string };
  ctaNote?: string;
  footerNote?: string;
}): RenderedAuthEmail {
  const html = renderSellqoEmail({
    preheader: opts.preheader,
    heading: opts.heading,
    intro: opts.intro,
    cta: opts.cta,
    ctaNote: opts.ctaNote,
    footerNote: opts.footerNote ??
      "Heb je deze e-mail niet aangevraagd? Dan kun je hem veilig negeren.",
    supportEmail,
  });
  return { subject: opts.subject, html, text: htmlToPlainText(html) };
}

// ── Templates ──────────────────────────────────────────────────────

export function magicLinkTemplate(ctx: AuthEmailContext): RenderedAuthEmail {
  return render({
    subject: "Je inloglink voor SellQo",
    preheader: "Klik op de knop om in te loggen — geldig 1 uur.",
    heading: "Inloggen bij SellQo",
    intro:
      "Klik op onderstaande knop om veilig in te loggen op je SellQo-account. " +
      "De link is 1 uur geldig en kan één keer gebruikt worden.",
    cta: { label: "Inloggen", url: ctx.confirmationUrl },
    ctaNote: `Werkt de knop niet? Gebruik deze code: <strong>${ctx.token}</strong>`,
  });
}

export function signupTemplate(ctx: AuthEmailContext): RenderedAuthEmail {
  return render({
    subject: "Bevestig je SellQo-account",
    preheader: "Nog één klik om je account te activeren.",
    heading: "Welkom bij SellQo",
    intro:
      "Bedankt voor je registratie. Bevestig je e-mailadres om je account te activeren " +
      "en aan de slag te gaan met je webshop.",
    cta: { label: "Account bevestigen", url: ctx.confirmationUrl },
    ctaNote: `Code als backup: <strong>${ctx.token}</strong>`,
  });
}

export function recoveryTemplate(ctx: AuthEmailContext): RenderedAuthEmail {
  return render({
    subject: "Wachtwoord opnieuw instellen",
    preheader: "Stel een nieuw wachtwoord in voor je SellQo-account.",
    heading: "Wachtwoord opnieuw instellen",
    intro:
      "We ontvingen een verzoek om je wachtwoord opnieuw in te stellen. " +
      "Klik op de knop om een nieuw wachtwoord te kiezen. De link is 1 uur geldig.",
    cta: { label: "Nieuw wachtwoord instellen", url: ctx.confirmationUrl },
    ctaNote: `Werkt de knop niet? Gebruik deze code: <strong>${ctx.token}</strong>`,
    footerNote:
      "Heb je dit verzoek niet gedaan? Negeer deze e-mail — je wachtwoord blijft ongewijzigd.",
  });
}

export function inviteTemplate(ctx: AuthEmailContext): RenderedAuthEmail {
  return render({
    subject: "Je bent uitgenodigd voor SellQo",
    preheader: "Accepteer je uitnodiging om aan de slag te gaan.",
    heading: "Je bent uitgenodigd",
    intro:
      "Je hebt een uitnodiging ontvangen om toegang te krijgen tot SellQo. " +
      "Klik op de knop om je account te activeren.",
    cta: { label: "Uitnodiging accepteren", url: ctx.confirmationUrl },
  });
}

export function emailChangeTemplate(ctx: AuthEmailContext): RenderedAuthEmail {
  const targetLabel = ctx.newEmail
    ? `Bevestig dat <strong>${ctx.newEmail}</strong> jouw nieuwe e-mailadres is.`
    : "Bevestig de wijziging van je e-mailadres.";
  return render({
    subject: "Bevestig je nieuwe e-mailadres",
    preheader: "Bevestig de wijziging van je e-mailadres.",
    heading: "Bevestig je e-mailadres",
    intro:
      targetLabel +
      " Klik op de knop hieronder om de wijziging te bevestigen.",
    cta: { label: "E-mailadres bevestigen", url: ctx.confirmationUrl },
    ctaNote: `Code als backup: <strong>${ctx.token}</strong>`,
    footerNote:
      "Heb je deze wijziging niet aangevraagd? Neem dan direct contact op via " +
      `<a href="mailto:${supportEmail}">${supportEmail}</a>.`,
  });
}

export function reauthenticationTemplate(ctx: AuthEmailContext): RenderedAuthEmail {
  return render({
    subject: "Bevestigingscode voor SellQo",
    preheader: "Gebruik deze code om je actie te bevestigen.",
    heading: "Bevestigingscode",
    intro:
      `Gebruik onderstaande code om je actie te bevestigen. ` +
      `De code is 10 minuten geldig.<br/><br/>` +
      `<div style="font-size:28px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#f7f9fc;border-radius:8px;">` +
      `${ctx.token}</div>`,
    footerNote:
      "Heb je dit niet aangevraagd? Negeer deze e-mail en wijzig je wachtwoord uit voorzorg.",
  });
}

export function renderAuthEmail(
  action: AuthEmailAction,
  ctx: AuthEmailContext,
): RenderedAuthEmail {
  switch (action) {
    case "signup":
      return signupTemplate(ctx);
    case "login":
    case "magiclink":
      return magicLinkTemplate(ctx);
    case "invite":
      return inviteTemplate(ctx);
    case "recovery":
      return recoveryTemplate(ctx);
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return emailChangeTemplate(ctx);
    case "reauthentication":
      return reauthenticationTemplate(ctx);
    default:
      return magicLinkTemplate(ctx);
  }
}
// RESERVATIE-2 — teksten van de mail aan een gast die online reserveerde (bevestigd of geweigerd).
// Puur, zodat het getest kan worden. Talen = de e-mailtalen van een zaak (TenantLocale: nl/en/fr/de).
import type { TenantLocale } from "./tenantEmail.ts";

export type ReservationOutcome = "booked" | "declined";
export interface ReservationMailInput { name: string; guests: number; startsAt: string; timezone: string; shop: string; note?: string | null }

interface Texts {
  subject: (o: ReservationOutcome, shop: string) => string;
  heading: (o: ReservationOutcome) => string;
  intro: (o: ReservationOutcome, name: string, shop: string) => string;
  when: string;
  guests: (n: number) => string;
  outro: (o: ReservationOutcome) => string;
}

const T: Record<TenantLocale, Texts> = {
  nl: {
    subject: (o, s) => (o === "booked" ? `Je reservatie bij ${s} is bevestigd` : `Je reservatie bij ${s}`),
    heading: (o) => (o === "booked" ? "Je reservatie is bevestigd" : "We kunnen je helaas niet ontvangen"),
    intro: (o, n, s) => (o === "booked" ? `Dag ${n}, ${s} verwacht je graag.` : `Dag ${n}, ${s} heeft op dat moment geen plaats meer.`),
    when: "Wanneer",
    guests: (n) => (n === 1 ? "1 persoon" : `${n} personen`),
    outro: (o) => (o === "booked" ? "Kan je toch niet komen? Laat het de zaak weten, dan geeft ze je tafel aan iemand anders." : "Probeer gerust een ander moment."),
  },
  en: {
    subject: (o, s) => (o === "booked" ? `Your reservation at ${s} is confirmed` : `Your reservation at ${s}`),
    heading: (o) => (o === "booked" ? "Your reservation is confirmed" : "Unfortunately we can't seat you"),
    intro: (o, n, s) => (o === "booked" ? `Hi ${n}, ${s} looks forward to seeing you.` : `Hi ${n}, ${s} has no room left at that time.`),
    when: "When",
    guests: (n) => (n === 1 ? "1 guest" : `${n} guests`),
    outro: (o) => (o === "booked" ? "Can't make it after all? Let the restaurant know so they can give your table to someone else." : "Feel free to try another time."),
  },
  fr: {
    subject: (o, s) => (o === "booked" ? `Votre réservation chez ${s} est confirmée` : `Votre réservation chez ${s}`),
    heading: (o) => (o === "booked" ? "Votre réservation est confirmée" : "Nous ne pouvons malheureusement pas vous accueillir"),
    intro: (o, n, s) => (o === "booked" ? `Bonjour ${n}, ${s} se réjouit de vous accueillir.` : `Bonjour ${n}, ${s} n’a plus de place à ce moment-là.`),
    when: "Quand",
    guests: (n) => (n === 1 ? "1 personne" : `${n} personnes`),
    outro: (o) => (o === "booked" ? "Vous ne pouvez finalement pas venir ? Prévenez l’établissement, il pourra donner votre table à quelqu’un d’autre." : "N’hésitez pas à essayer un autre moment."),
  },
  de: {
    subject: (o, s) => (o === "booked" ? `Deine Reservierung bei ${s} ist bestätigt` : `Deine Reservierung bei ${s}`),
    heading: (o) => (o === "booked" ? "Deine Reservierung ist bestätigt" : "Leider können wir dich nicht empfangen"),
    intro: (o, n, s) => (o === "booked" ? `Hallo ${n}, ${s} freut sich auf dich.` : `Hallo ${n}, ${s} hat zu dieser Zeit keinen Platz mehr.`),
    when: "Wann",
    guests: (n) => (n === 1 ? "1 Person" : `${n} Personen`),
    outro: (o) => (o === "booked" ? "Du kannst doch nicht kommen? Sag dem Lokal Bescheid, damit es deinen Tisch weitergeben kann." : "Versuch es gern zu einer anderen Zeit."),
  },
};

const LOCALE: Record<TenantLocale, string> = { nl: "nl-BE", en: "en-GB", fr: "fr-BE", de: "de-BE" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function reservationWhen(startsAt: string, timezone: string, locale: TenantLocale): string {
  return new Intl.DateTimeFormat(LOCALE[locale], { timeZone: timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(startsAt));
}

export function reservationMail(outcome: ReservationOutcome, r: ReservationMailInput, locale: TenantLocale) {
  const L = T[locale] ?? T.nl;
  const when = reservationWhen(r.startsAt, r.timezone, locale);
  return {
    subject: L.subject(outcome, r.shop),
    heading: L.heading(outcome),
    preheader: L.intro(outcome, r.name, r.shop),
    intro: `<p>${esc(L.intro(outcome, r.name, r.shop))}</p>`,
    content: `<p><strong>${esc(L.when)}:</strong> ${esc(when)}<br/>${esc(L.guests(r.guests))}</p><p>${esc(L.outro(outcome))}</p>`,
  };
}

export const RESERVATION_MAIL_LOCALES = Object.keys(T) as TenantLocale[];

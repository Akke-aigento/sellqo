// MELDING-1 — tekst, link en samenvoeg-tag van een horeca-melding per toestel.
//
// Puur (geen databank, geen netwerk) zodat het getest kan worden. De taal komt uit het
// toestelprofiel (horeca_notify_devices.lang). Ontbreekt een taal, dan Nederlands: een melding
// toont nooit een sleutelpad.
//
// Talen = SUPPORTED_LANGUAGES uit src/i18n/languages.ts. Nieuwe taal daar = ook hier
// (horecaPush.test.ts controleert dat elke taal elke tekst heeft).

export type HorecaEvent = "qr_request" | "ticket_new" | "ticket_ready" | "paid_online";
export const HORECA_EVENTS: HorecaEvent[] = ["qr_request", "ticket_new", "ticket_ready", "paid_online"];

export interface HorecaPushCtx {
  ref?: string | null;
  table?: string | null;
  /** Afhaal-, lever-, telefoon- of toogbon zonder tafel: de klant(naam) of het bestelnummer. */
  customer?: string | null;
  station?: string | null;
  items?: number | null;
  count?: number | null;
  amount_cents?: number | null;
  tip_cents?: number | null;
  kind?: string | null;
  /** paid_online: de rekening van de tafel staat na deze betaling nog open. */
  rest_open?: boolean | null;
  /** OBER-ROEPEN-1: qr_request met een oproep van de tafel ('waiter' | 'bill') i.p.v. een bestelling. */
  call?: string | null;
  /** OBER-ROEPEN-1: hoeveelste keer deze tafel roept (zelfde oproep). */
  repeat?: number | null;
  /** RESERVATIE-MELDING-1: qr_request voor een nieuwe online reservatie-aanvraag (zonder naam). */
  reservation?: boolean | null;
  guests?: number | null;
  /** Tijdstip zoals de zaak het leest, al opgemaakt ("02/11 19:30"). */
  at?: string | null;
}

export interface HorecaPushMessage {
  title: string;
  body: string;
  url: string;
  /** Een nieuwe melding met dezelfde tag vervangt de vorige (samenvoegen per post). */
  tag: string;
}

type Texts = {
  table: (t: string) => string;
  noTable: string;
  items: (n: number) => string;
  qrTitle: (n: number) => string;
  qrBody: string;
  ticketTitle: (station: string, n: number) => string;
  ticketBody: string;
  readyTitle: (table: string) => string;
  readyBody: (station: string) => string;
  paidTitle: (table: string) => string;
  paidTip: (tip: string) => string;
  paidRest: string;
  kitchen: string;
  callWaiter: (table: string) => string;
  callBill: (table: string) => string;
  callBody: (n: number) => string;
  resTitle: string;
  resBody: (guests: number, at: string) => string;
};

export const HORECA_PUSH_TEXTS: Record<string, Texts> = {
  nl: {
    table: (t) => `tafel ${t}`,
    noTable: "zonder tafel",
    items: (n) => (n === 1 ? "1 item" : `${n} items`),
    qrTitle: (n) => (n > 1 ? `${n} QR-bestellingen wachten` : "QR-bestelling wacht"),
    qrBody: "Bevestig in de kassa.",
    ticketTitle: (s, n) => (n > 1 ? `${s}: ${n} nieuwe bonnen` : `${s}: nieuwe bon`),
    ticketBody: "Laatste:",
    readyTitle: (t) => `Klaar: ${t}`,
    readyBody: (s) => `${s} — mag weg.`,
    paidTitle: (t) => `${cap(t)} betaalde online`,
    paidTip: (tip) => `+ ${tip} fooi`,
    paidRest: "De kassa rekent de rest af.",
    kitchen: "Keuken",
    callWaiter: (t) => `${cap(t)} roept de bediening`,
    callBill: (t) => `${cap(t)} vraagt de rekening`,
    callBody: (n) => (n > 1 ? `${n}e keer. Afhandelen in de kassa.` : "Afhandelen in de kassa."),
    resTitle: "Nieuwe reservatie-aanvraag",
    resBody: (g, at) => `${g} pers. · ${at}. Bevestig of weiger.`,
  },
  en: {
    table: (t) => `table ${t}`,
    noTable: "no table",
    items: (n) => (n === 1 ? "1 item" : `${n} items`),
    qrTitle: (n) => (n > 1 ? `${n} QR orders waiting` : "QR order waiting"),
    qrBody: "Confirm it on the POS.",
    ticketTitle: (s, n) => (n > 1 ? `${s}: ${n} new tickets` : `${s}: new ticket`),
    ticketBody: "Latest:",
    readyTitle: (t) => `Ready: ${t}`,
    readyBody: (s) => `${s} — ready to serve.`,
    paidTitle: (t) => `${cap(t)} paid online`,
    paidTip: (tip) => `+ ${tip} tip`,
    paidRest: "Settle the rest on the POS.",
    kitchen: "Kitchen",
    callWaiter: (t) => `${cap(t)} is calling for service`,
    callBill: (t) => `${cap(t)} asks for the bill`,
    callBody: (n) => (n > 1 ? `Call #${n}. Handle it on the POS.` : "Handle it on the POS."),
    resTitle: "New reservation request",
    resBody: (g, at) => `${g} guests · ${at}. Confirm or decline.`,
  },
  fr: {
    table: (t) => `table ${t}`,
    noTable: "sans table",
    items: (n) => (n === 1 ? "1 article" : `${n} articles`),
    qrTitle: (n) => (n > 1 ? `${n} commandes QR en attente` : "Commande QR en attente"),
    qrBody: "Confirmez-la à la caisse.",
    ticketTitle: (s, n) => (n > 1 ? `${s} : ${n} nouveaux bons` : `${s} : nouveau bon`),
    ticketBody: "Dernier :",
    readyTitle: (t) => `Prêt : ${t}`,
    readyBody: (s) => `${s} — peut être servi.`,
    paidTitle: (t) => `${cap(t)} a payé en ligne`,
    paidTip: (tip) => `+ ${tip} de pourboire`,
    paidRest: "La caisse encaisse le reste.",
    kitchen: "Cuisine",
    callWaiter: (t) => `${cap(t)} appelle le service`,
    callBill: (t) => `${cap(t)} demande l’addition`,
    callBody: (n) => (n > 1 ? `${n}e appel. À traiter à la caisse.` : "À traiter à la caisse."),
    resTitle: "Nouvelle demande de réservation",
    resBody: (g, at) => `${g} pers. · ${at}. Confirmez ou refusez.`,
  },
  de: {
    table: (t) => `Tisch ${t}`,
    noTable: "ohne Tisch",
    items: (n) => (n === 1 ? "1 Artikel" : `${n} Artikel`),
    qrTitle: (n) => (n > 1 ? `${n} QR-Bestellungen warten` : "QR-Bestellung wartet"),
    qrBody: "Bitte an der Kasse bestätigen.",
    ticketTitle: (s, n) => (n > 1 ? `${s}: ${n} neue Bons` : `${s}: neuer Bon`),
    ticketBody: "Zuletzt:",
    readyTitle: (t) => `Fertig: ${t}`,
    readyBody: (s) => `${s} — kann raus.`,
    paidTitle: (t) => `${cap(t)} hat online bezahlt`,
    paidTip: (tip) => `+ ${tip} Trinkgeld`,
    paidRest: "Den Rest an der Kasse abrechnen.",
    kitchen: "Küche",
    callWaiter: (t) => `${cap(t)} ruft die Bedienung`,
    callBill: (t) => `${cap(t)} möchte zahlen`,
    callBody: (n) => (n > 1 ? `${n}. Ruf. An der Kasse erledigen.` : "An der Kasse erledigen."),
    resTitle: "Neue Reservierungsanfrage",
    resBody: (g, at) => `${g} Pers. · ${at}. Bestätigen oder ablehnen.`,
  },
  uk: {
    table: (t) => `стіл ${t}`,
    noTable: "без столу",
    items: (n) => `${n} поз.`,
    qrTitle: (n) => (n > 1 ? `${n} QR-замовлень чекають` : "QR-замовлення чекає"),
    qrBody: "Підтвердьте на касі.",
    ticketTitle: (s, n) => (n > 1 ? `${s}: ${n} нових чеків` : `${s}: новий чек`),
    ticketBody: "Останній:",
    readyTitle: (t) => `Готово: ${t}`,
    readyBody: (s) => `${s} — можна подавати.`,
    paidTitle: (t) => `${cap(t)} оплатив онлайн`,
    paidTip: (tip) => `+ ${tip} чайових`,
    paidRest: "Решту розрахуйте на касі.",
    kitchen: "Кухня",
    callWaiter: (t) => `${cap(t)} кличе офіціанта`,
    callBill: (t) => `${cap(t)} просить рахунок`,
    callBody: (n) => (n > 1 ? `Виклик №${n}. Обробіть на касі.` : "Обробіть на касі."),
    resTitle: "Новий запит на бронювання",
    resBody: (g, at) => `${g} ос. · ${at}. Підтвердьте або відхиліть.`,
  },
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const LOCALE: Record<string, string> = { nl: "nl-BE", en: "en-GB", fr: "fr-BE", de: "de-BE", uk: "uk-UA" };

export function euro(cents: number, lang: string): string {
  return new Intl.NumberFormat(LOCALE[lang] ?? "nl-BE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Hoelang een horeca-melding geldig blijft bij de pushdienst: een bon van een uur geleden is geen nieuws. */
export const HORECA_PUSH_TTL_SECONDS = 900;

/** Waar een tik op de melding naartoe gaat. De kassa- en keukenschermen openen zichzelf; een gsm of ander
 *  toestel heeft geen gekoppelde kassa en opent daarom de admin (anders vraagt /kassa om te koppelen). */
function urlFor(event: string, kind: string | null | undefined): string {
  if (event === "ticket_new") return "/admin/keuken";
  if (kind === "kassa") return "/kassa";
  if (kind === "station") return "/admin/keuken";
  return event === "ticket_ready" ? "/admin/keuken" : "/admin/pos";
}

/** Tekst, link en tag voor één toestel. Geeft null bij een onbekend event. */
export function buildHorecaPush(event: string, ctx: HorecaPushCtx, lang: string, stationId?: string | null, kind?: string | null): HorecaPushMessage | null {
  const L = HORECA_PUSH_TEXTS[lang] ?? HORECA_PUSH_TEXTS.nl;
  const table = ctx.table ? L.table(String(ctx.table)) : ctx.customer ? String(ctx.customer) : L.noTable;
  const url = urlFor(event, kind);
  const count = Math.max(1, Number(ctx.count ?? 1) || 1);
  switch (event) {
    case "qr_request":
      // OBER-ROEPEN-1 — een oproep van de tafel (ober of rekening) loopt via hetzelfde profiel.
      // RESERVATIE-MELDING-1 — een nieuwe online reservatie-aanvraag (zonder naam: gedeeld toestel).
      if (ctx.reservation) {
        return {
          title: L.resTitle,
          body: L.resBody(Math.max(1, Number(ctx.guests ?? 1) || 1), String(ctx.at ?? "")),
          url: kind === "kassa" ? "/kassa" : "/admin/bestellen?tab=reservaties",
          tag: `sq-res-${String(ctx.ref ?? "").slice(0, 8)}`,
        };
      }
      if (ctx.call === "waiter" || ctx.call === "bill") {
        return {
          title: ctx.call === "bill" ? L.callBill(table) : L.callWaiter(table),
          body: L.callBody(Math.max(1, Number(ctx.repeat ?? 1) || 1)),
          url,
          tag: `sq-call-${String(ctx.ref ?? "").slice(0, 8)}`,
        };
      }
      return {
        title: L.qrTitle(count),
        body: `${cap(table)}${ctx.items ? ` · ${L.items(Number(ctx.items))}` : ""}. ${L.qrBody}`,
        url,
        tag: "sq-qr",
      };
    case "ticket_new": {
      const station = ctx.station || L.kitchen;
      return {
        title: L.ticketTitle(station, count),
        body: `${L.ticketBody} ${table}${ctx.items ? ` · ${L.items(Number(ctx.items))}` : ""}`,
        url,
        tag: `sq-ticket-${(stationId ?? "default").slice(0, 8)}`,
      };
    }
    case "ticket_ready":
      return {
        title: L.readyTitle(table),
        body: L.readyBody(ctx.station || L.kitchen),
        url,
        // Elke klare bon is een eigen opdracht voor de bediening: niet samenvoegen.
        tag: `sq-ready-${String(ctx.ref ?? "").slice(0, 8)}`,
      };
    case "paid_online": {
      const amount = euro(Number(ctx.amount_cents ?? 0), lang);
      const tip = Number(ctx.tip_cents ?? 0) > 0 ? ` ${L.paidTip(euro(Number(ctx.tip_cents), lang))}` : "";
      const rest = ctx.rest_open ? ` ${L.paidRest}` : "";
      return {
        title: L.paidTitle(table),
        body: `${amount}${tip}.${rest}`,
        url,
        tag: `sq-paid-${String(ctx.ref ?? "").slice(0, 8)}`,
      };
    }
    default:
      return null;
  }
}

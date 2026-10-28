// PRINT-2 — keuken-/barbonnen en betaalbewijzen als platte tekst (bonprinter) en als HTML (mail).
//
// Puur (geen databank, geen netwerk) zodat het getest kan worden; horeca-print en
// horeca-receipt-mail vullen de modellen. Waarom niet src/kassa/print hergebruiken: die laag
// drukt enkel ondertekende fiscale events af (buildKitchenTicket vraagt een signOrder van de
// FDM) en importeert zonder extensies, wat Deno niet laadt. Deze bonnen zijn géén fiscale
// documenten:
//   - een productiebon (keuken/bar) draagt nooit een bedrag (zoals PRT-05);
//   - een betaalbewijs draagt altijd "DIT IS GEEN GELDIG BTW-KASTICKET" (zoals PRT-04) en geen
//     btw-uitsplitsing. Bij een geregistreerde kassa (FDM) maakt de kassa zelf het kasticket;
//     daar wordt dit betaalbewijs nooit gemaakt (zie horeca-print).
//
// Talen = SUPPORTED_LANGUAGES uit src/i18n/languages.ts (horecaPrint.test.ts controleert dat).
// Bedragen als "EUR 12,50": het euroteken komt niet op elke bonprinter goed door (text/plain).

export type PrintWidth = 32 | 42 | 48;
export const PRINT_WIDTHS: PrintWidth[] = [32, 42, 48];

export interface ProductionItem {
  quantity: number;
  name: string;
  detail?: string | null;
  addons?: string[];
}

export interface ProductionTicket {
  storeName: string;
  station: string | null;
  source: "webshop" | "pos" | "phone" | "table";
  service: "pickup" | "local_delivery" | "eat_in" | null;
  table: string | null;
  customer: string | null;
  phone: string | null;
  /** Gewenst tijdstip (afhalen/leveren); null = zo snel mogelijk. */
  requestedTime: string | null;
  createdAt: string;
  note: string | null;
  items: ProductionItem[];
}

export interface ReceiptLine { quantity: number; name: string; totalCents: number; addons?: string[] }
export interface ReceiptTender { method: string; amountCents: number }

export interface ReceiptModel {
  storeName: string;
  address: string[];
  vatNumber: string | null;
  /** kassa = afgerekend aan de kassa, online = de gast betaalde via de QR aan tafel. */
  origin: "kassa" | "online";
  /** online: full = hele rekening, share = gelijk deel, items = eigen items. */
  onlineKind?: "full" | "share" | "items" | null;
  table: string | null;
  when: string;
  receiptNo: string | null;
  lines: ReceiptLine[];
  /** Totaal van wat deze betaling dekt (zonder fooi). */
  paidCents: number;
  /** Online "hele rekening": wat gasten eerder al online betaalden (de lijnen tonen de hele rekening). */
  prepaidCents?: number;
  tipCents: number;
  roundingCents?: number;
  tenders: ReceiptTender[];
  /** De rekening van de tafel staat na deze betaling nog open (deelbetaling). */
  restOpen: boolean;
}

type Texts = {
  kitchen: string; bar: string; order: string; asap: string;
  service: Record<"pickup" | "local_delivery" | "eat_in", string>;
  source: Record<"webshop" | "pos" | "phone" | "table", string>;
  table: (t: string) => string;
  ordered: string; printed: string;
  receipt: string; notValid: string; receiptNo: string; total: string; tip: string; rounding: string;
  paidWith: string; prepaid: string; partial: string; restOpen: string; vat: string;
  onlineKind: Record<"full" | "share" | "items", string>;
  method: Record<string, string>;
  thanks: string;
  test: string; testBody: string;
  mailSubject: (store: string) => string; mailHeading: string; mailIntro: (store: string) => string;
};

export const HORECA_PRINT_TEXTS: Record<string, Texts> = {
  nl: {
    kitchen: "KEUKEN", bar: "BAR", order: "BESTELLING", asap: "zo snel mogelijk",
    service: { pickup: "AFHALEN", local_delivery: "LEVEREN", eat_in: "TER PLAATSE" },
    source: { webshop: "Webshop", pos: "Kassa", phone: "Telefoon", table: "Tafel" },
    table: (t) => `Tafel ${t}`,
    ordered: "Besteld", printed: "Afgedrukt",
    receipt: "BETAALBEWIJS", notValid: "DIT IS GEEN GELDIG BTW-KASTICKET", receiptNo: "Bon", total: "Totaal", tip: "Fooi", rounding: "Afronding",
    paidWith: "Betaald met", prepaid: "Eerder online betaald", partial: "Deelbetaling", restOpen: "De rest van de rekening staat nog open.", vat: "Btw",
    onlineKind: { full: "Hele rekening", share: "Jouw deel van de rekening", items: "Jouw items" },
    method: { cash: "Contant", card: "Kaart", transfer: "Overschrijving", cheque_meal: "Maaltijdcheque", voucher: "Bon", other: "Andere", online: "Online" },
    thanks: "Bedankt en tot ziens!",
    test: "TESTAFDRUK", testBody: "Deze printer is goed gekoppeld aan SellQo.",
    mailSubject: (s) => `Je betaalbewijs van ${s}`, mailHeading: "Je betaalbewijs", mailIntro: (s) => `Bedankt voor je bezoek aan ${s}. Hieronder vind je je betaalbewijs.`,
  },
  en: {
    kitchen: "KITCHEN", bar: "BAR", order: "ORDER", asap: "as soon as possible",
    service: { pickup: "PICKUP", local_delivery: "DELIVERY", eat_in: "EAT IN" },
    source: { webshop: "Web shop", pos: "POS", phone: "Phone", table: "Table" },
    table: (t) => `Table ${t}`,
    ordered: "Ordered", printed: "Printed",
    receipt: "PAYMENT RECEIPT", notValid: "DIT IS GEEN GELDIG BTW-KASTICKET", receiptNo: "Receipt", total: "Total", tip: "Tip", rounding: "Rounding",
    paidWith: "Paid with", prepaid: "Paid online earlier", partial: "Partial payment", restOpen: "The rest of the bill is still open.", vat: "VAT",
    onlineKind: { full: "Whole bill", share: "Your share of the bill", items: "Your items" },
    method: { cash: "Cash", card: "Card", transfer: "Bank transfer", cheque_meal: "Meal voucher", voucher: "Voucher", other: "Other", online: "Online" },
    thanks: "Thank you and see you soon!",
    test: "TEST PRINT", testBody: "This printer is connected to SellQo.",
    mailSubject: (s) => `Your payment receipt from ${s}`, mailHeading: "Your payment receipt", mailIntro: (s) => `Thank you for visiting ${s}. Your payment receipt is below.`,
  },
  fr: {
    kitchen: "CUISINE", bar: "BAR", order: "COMMANDE", asap: "dès que possible",
    service: { pickup: "À EMPORTER", local_delivery: "LIVRAISON", eat_in: "SUR PLACE" },
    source: { webshop: "Boutique en ligne", pos: "Caisse", phone: "Téléphone", table: "Table" },
    table: (t) => `Table ${t}`,
    ordered: "Commandé", printed: "Imprimé",
    receipt: "PREUVE DE PAIEMENT", notValid: "CECI N'EST PAS UN TICKET DE CAISSE TVA VALABLE", receiptNo: "Ticket", total: "Total", tip: "Pourboire", rounding: "Arrondi",
    paidWith: "Payé par", prepaid: "Déjà payé en ligne", partial: "Paiement partiel", restOpen: "Le reste de l'addition est encore ouvert.", vat: "TVA",
    onlineKind: { full: "Addition complète", share: "Votre part de l'addition", items: "Vos articles" },
    method: { cash: "Espèces", card: "Carte", transfer: "Virement", cheque_meal: "Chèque-repas", voucher: "Bon", other: "Autre", online: "En ligne" },
    thanks: "Merci et à bientôt !",
    test: "IMPRESSION TEST", testBody: "Cette imprimante est bien connectée à SellQo.",
    mailSubject: (s) => `Votre preuve de paiement de ${s}`, mailHeading: "Votre preuve de paiement", mailIntro: (s) => `Merci de votre visite chez ${s}. Voici votre preuve de paiement.`,
  },
  de: {
    kitchen: "KÜCHE", bar: "BAR", order: "BESTELLUNG", asap: "so schnell wie möglich",
    service: { pickup: "ABHOLUNG", local_delivery: "LIEFERUNG", eat_in: "VOR ORT" },
    source: { webshop: "Webshop", pos: "Kasse", phone: "Telefon", table: "Tisch" },
    table: (t) => `Tisch ${t}`,
    ordered: "Bestellt", printed: "Gedruckt",
    receipt: "ZAHLUNGSBELEG", notValid: "DIES IST KEIN GÜLTIGER MWST-KASSENBON", receiptNo: "Beleg", total: "Summe", tip: "Trinkgeld", rounding: "Rundung",
    paidWith: "Bezahlt mit", prepaid: "Vorher online bezahlt", partial: "Teilzahlung", restOpen: "Der Rest der Rechnung ist noch offen.", vat: "MwSt",
    onlineKind: { full: "Ganze Rechnung", share: "Dein Anteil an der Rechnung", items: "Deine Artikel" },
    method: { cash: "Bar", card: "Karte", transfer: "Überweisung", cheque_meal: "Essensgutschein", voucher: "Gutschein", other: "Andere", online: "Online" },
    thanks: "Danke und bis bald!",
    test: "TESTDRUCK", testBody: "Dieser Drucker ist mit SellQo verbunden.",
    mailSubject: (s) => `Dein Zahlungsbeleg von ${s}`, mailHeading: "Dein Zahlungsbeleg", mailIntro: (s) => `Danke für deinen Besuch bei ${s}. Unten findest du deinen Zahlungsbeleg.`,
  },
  uk: {
    kitchen: "КУХНЯ", bar: "БАР", order: "ЗАМОВЛЕННЯ", asap: "якнайшвидше",
    service: { pickup: "САМОВИВІЗ", local_delivery: "ДОСТАВКА", eat_in: "НА МІСЦІ" },
    source: { webshop: "Вебмагазин", pos: "Каса", phone: "Телефон", table: "Стіл" },
    table: (t) => `Стіл ${t}`,
    ordered: "Замовлено", printed: "Надруковано",
    receipt: "ПІДТВЕРДЖЕННЯ ОПЛАТИ", notValid: "DIT IS GEEN GELDIG BTW-KASTICKET", receiptNo: "Чек", total: "Разом", tip: "Чайові", rounding: "Округлення",
    paidWith: "Оплачено", prepaid: "Раніше сплачено онлайн", partial: "Часткова оплата", restOpen: "Решта рахунку ще відкрита.", vat: "ПДВ",
    onlineKind: { full: "Весь рахунок", share: "Ваша частка рахунку", items: "Ваші позиції" },
    method: { cash: "Готівка", card: "Картка", transfer: "Переказ", cheque_meal: "Талон на харчування", voucher: "Ваучер", other: "Інше", online: "Онлайн" },
    thanks: "Дякуємо і до зустрічі!",
    test: "ТЕСТОВИЙ ДРУК", testBody: "Цей принтер підключено до SellQo.",
    mailSubject: (s) => `Ваше підтвердження оплати від ${s}`, mailHeading: "Ваше підтвердження оплати", mailIntro: (s) => `Дякуємо за візит до ${s}. Нижче ваше підтвердження оплати.`,
  },
};

export function printTexts(lang: string | null | undefined): Texts {
  return HORECA_PRINT_TEXTS[String(lang ?? "")] ?? HORECA_PRINT_TEXTS.nl;
}

const LOCALE: Record<string, string> = { nl: "nl-BE", en: "en-GB", fr: "fr-BE", de: "de-BE", uk: "uk-UA" };
const TZ = "Europe/Brussels";

export function printWidth(w: unknown): PrintWidth {
  return (PRINT_WIDTHS as number[]).includes(Number(w)) ? (Number(w) as PrintWidth) : 42;
}

/** "EUR 12,50" — vaste notatie, ook voor Engels (Belgische zaak). */
export function money(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return `${neg ? "-" : ""}EUR ${s}`;
}

function hhmm(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(LOCALE[lang] ?? "nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function dateTime(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(LOCALE[lang] ?? "nl-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/** Breekt een tekst op woorden zodat geen regel breder is dan w (lange woorden worden geknipt). */
export function wrap(text: string, w: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").replace(/\r/g, "").split("\n")) {
    let line = "";
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > w) {
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, w));
        word = word.slice(w);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= w) line += ` ${word}`;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

function center(text: string, w: number): string[] {
  return wrap(text, w).map((l) => " ".repeat(Math.max(0, Math.floor((w - l.length) / 2))) + l);
}

/** Links tekst, rechts een bedrag; de tekst breekt af zodat het bedrag altijd rechts past. */
function leftRight(left: string, right: string, w: number, indent = 0): string[] {
  const room = Math.max(8, w - right.length - 1);
  const parts = wrap(left, room - indent).map((p, i) => (i === 0 ? " ".repeat(indent) + p : " ".repeat(indent + 2) + p));
  const last = parts.pop() ?? "";
  return [...parts, last + " ".repeat(Math.max(1, w - last.length - right.length)) + right];
}

const rule = (w: number, ch = "-") => ch.repeat(w);

/** Keuken-/barbon. Nooit een bedrag. */
export function renderProductionTicket(t: ProductionTicket, stationKind: string | null, lang: string, width: number): string {
  const w = printWidth(width);
  const L = printTexts(lang);
  const title = t.station ? t.station.toUpperCase() : stationKind === "bar" ? L.bar : L.kitchen;
  const out: string[] = [];
  out.push(...center(t.storeName, w));
  out.push(...center(title, w));
  const svc = t.service ? L.service[t.service] : L.order;
  out.push(...center(`${svc} ${t.requestedTime ? hhmm(t.requestedTime, lang) : L.asap}`, w));
  const where = t.table ? L.table(t.table) : L.source[t.source];
  out.push(...center(where, w));
  const who = [t.table ? t.customer && t.customer !== t.table ? t.customer : null : t.customer, t.phone].filter(Boolean).join(" · ");
  if (who) out.push(...center(who, w));
  out.push(rule(w));
  for (const it of t.items) {
    // Een annulering in een ronde komt als negatief aantal: die moet de keuken zien ("-1 x").
    const q = `${Math.round(Number(it.quantity)) || 1} x `;
    const name = wrap(it.name || "?", w - q.length);
    out.push(q + name[0], ...name.slice(1).map((n) => " ".repeat(q.length) + n));
    if (it.detail) out.push(...wrap(it.detail, w - q.length).map((d) => " ".repeat(q.length) + d));
    for (const a of it.addons ?? []) out.push(...wrap(`+ ${a}`, w - q.length).map((d) => " ".repeat(q.length) + d));
  }
  if (t.note) { out.push(rule(w)); out.push(...wrap(t.note, w)); }
  out.push(rule(w));
  out.push(...center(`${L.ordered} ${hhmm(t.createdAt, lang)} · ${L.printed} ${hhmm(new Date().toISOString(), lang)}`, w));
  return out.join("\n") + "\n\n\n";
}

function receiptHeader(m: ReceiptModel, L: Texts): string {
  return m.origin === "online" && m.onlineKind ? L.onlineKind[m.onlineKind] : (m.restOpen ? L.partial : "");
}

/** Betaalbewijs als platte tekst (bonprinter). */
export function renderReceiptText(m: ReceiptModel, lang: string, width: number): string {
  const w = printWidth(width);
  const L = printTexts(lang);
  const out: string[] = [];
  out.push(...center(m.storeName, w));
  for (const a of m.address) out.push(...center(a, w));
  if (m.vatNumber) out.push(...center(`${L.vat} ${m.vatNumber}`, w));
  out.push(rule(w));
  out.push(...center(L.receipt, w));
  out.push(...center(dateTime(m.when, lang), w));
  if (m.table) out.push(...center(L.table(m.table), w));
  if (m.receiptNo) out.push(...center(`${L.receiptNo} ${m.receiptNo}`, w));
  const head = receiptHeader(m, L);
  if (head) out.push(...center(head, w));
  out.push(rule(w));
  for (const l of m.lines) {
    out.push(...leftRight(`${Math.round(l.quantity)} x ${l.name}`, money(l.totalCents), w));
    for (const a of l.addons ?? []) out.push(...wrap(`+ ${a}`, w - 4).map((x) => `    ${x}`));
  }
  if (m.lines.length) out.push(rule(w));
  if (m.prepaidCents) out.push(...leftRight(L.prepaid, money(-m.prepaidCents), w));
  out.push(...leftRight(L.total, money(m.paidCents), w));
  if (m.roundingCents) out.push(...leftRight(L.rounding, money(m.roundingCents), w));
  if (m.tipCents > 0) out.push(...leftRight(L.tip, money(m.tipCents), w));
  if (m.tenders.length) {
    out.push(L.paidWith);
    for (const t of m.tenders) out.push(...leftRight(L.method[t.method] ?? L.method.other, money(t.amountCents), w, 2));
  }
  if (m.restOpen) { out.push(rule(w)); out.push(...wrap(L.restOpen, w)); }
  out.push(rule(w));
  out.push(...center(L.notValid, w));
  out.push(...center(L.thanks, w));
  return out.join("\n") + "\n\n\n";
}

const escHtml = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Inhoud van de mail (binnen de tenantmail): tabel met lijnen, totaal en betaalwijze. */
export function renderReceiptHtml(m: ReceiptModel, lang: string): string {
  const L = printTexts(lang);
  const td = "padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:14px;";
  const tdr = `${td}text-align:right;white-space:nowrap;`;
  const meta = [dateTime(m.when, lang), m.table ? L.table(m.table) : null, m.receiptNo ? `${L.receiptNo} ${m.receiptNo}` : null, receiptHeader(m, L) || null]
    .filter(Boolean).map((x) => escHtml(String(x))).join(" · ");
  const rows = m.lines.map((l) => `<tr><td style="${td}">${Math.round(l.quantity)} × ${escHtml(l.name)}${(l.addons ?? []).map((a) => `<div style="font-size:12px;color:#6b7280;">+ ${escHtml(a)}</div>`).join("")}</td><td style="${tdr}">${escHtml(money(l.totalCents))}</td></tr>`).join("");
  const sum = (label: string, cents: number, bold = false) => `<tr><td style="${td}${bold ? "font-weight:700;" : ""}">${escHtml(label)}</td><td style="${tdr}${bold ? "font-weight:700;" : ""}">${escHtml(money(cents))}</td></tr>`;
  const tenders = m.tenders.length
    ? `<p style="margin:12px 0 0;font-size:13px;color:#374151;">${escHtml(L.paidWith)}: ${m.tenders.map((t) => `${escHtml(L.method[t.method] ?? L.method.other)} ${escHtml(money(t.amountCents))}`).join(", ")}</p>`
    : "";
  return `<p style="margin:16px 0 8px;font-size:13px;color:#6b7280;">${meta}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}
${m.prepaidCents ? sum(L.prepaid, -m.prepaidCents) : ""}${sum(L.total, m.paidCents, true)}${m.roundingCents ? sum(L.rounding, m.roundingCents) : ""}${m.tipCents > 0 ? sum(L.tip, m.tipCents) : ""}</table>
${tenders}
${m.restOpen ? `<p style="margin:12px 0 0;font-size:13px;color:#374151;">${escHtml(L.restOpen)}</p>` : ""}
<p style="margin:16px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;">${escHtml(L.notValid)}</p>`;
}

/** Testafdruk voor een nieuwe printer. */
export function renderTestPage(storeName: string, printerName: string, lang: string, width: number): string {
  const w = printWidth(width);
  const L = printTexts(lang);
  return [...center(storeName, w), rule(w), ...center(L.test, w), ...center(printerName, w), ...center(dateTime(new Date().toISOString(), lang), w), rule(w),
    ...wrap(L.testBody, w), "1234567890".repeat(Math.ceil(w / 10)).slice(0, w), rule(w, "=")].join("\n") + "\n\n\n";
}

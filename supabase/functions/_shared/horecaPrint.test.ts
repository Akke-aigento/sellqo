// PRINT-2 — keuken-/barbonnen en betaalbewijzen (tekst + mail-HTML).
import { HORECA_PRINT_TEXTS, PRINT_WIDTHS, money, renderProductionTicket, renderReceiptHtml, renderReceiptText, renderTestPage, wrap, type ProductionTicket } from "./horecaPrint.ts";
import { isMailAddress, mergeLines, receiptModelFromData, type ReceiptData } from "./horecaReceipt.ts";
// Bron: src/i18n/languages.ts (SUPPORTED_LANGUAGES). Een nieuwe taal daar hoort ook in HORECA_PRINT_TEXTS.
import { LANG_CODES } from "../../../src/i18n/languages.ts";

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };

const ticket: ProductionTicket = {
  storeName: "Belgaleiro", station: "Keuken", source: "table", service: "eat_in", table: "B7", customer: null, phone: null,
  requestedTime: null, createdAt: "2026-10-28T19:00:00Z", note: "Allergie: noten — extra lange opmerking die zeker moet afbreken op een smalle bon",
  items: [
    { quantity: 2, name: "Spaghetti bolognese met een heel lange naam die moet afbreken", detail: "zonder ui", addons: ["Extra kaas"] },
    { quantity: -1, name: "Cola", addons: [] },
  ],
};

const data: ReceiptData = {
  tenant_id: "00000000-0000-0000-0000-000000000001", store_name: "Belgaleiro", address: ["Bondgenotenlaan 1", "3000 Leuven", null],
  vat_number: "BE0123456789", tenant_lang: "nl", origin: "kassa", online_kind: null, table: "B7", when: "2026-10-28T20:15:00Z", receipt_no: "K-0001",
  lines: [
    { quantity: 2, name: "Pils", total_cents: 600, addons: [] },
    { quantity: 1, name: "Croque", total_cents: 1250, addons: ["Extra ham"] },
    { quantity: -1, name: "Croque", total_cents: -1250, addons: ["Extra ham"] },
  ],
  paid_cents: 600, tip_cents: 100, rounding_cents: 0, tenders: [{ method: "cash", amount_cents: 700 }, { method: "card", amount_cents: 0 }],
  rest_open: false, fiscal: false, status: "paid", stripe_session_id: null,
};

Deno.test("elke ondersteunde taal heeft elke tekst", () => {
  const keys = Object.keys(HORECA_PRINT_TEXTS.nl).sort().join(",");
  for (const lang of LANG_CODES as readonly string[]) {
    assert(HORECA_PRINT_TEXTS[lang], `taal ${lang} ontbreekt in HORECA_PRINT_TEXTS`);
    assert(Object.keys(HORECA_PRINT_TEXTS[lang]).sort().join(",") === keys, `taal ${lang} mist teksten`);
  }
});

Deno.test("productiebon: geen bedrag, nergens breder dan de printer, annulering als negatief aantal", () => {
  for (const w of PRINT_WIDTHS) {
    for (const lang of LANG_CODES as readonly string[]) {
      const text = renderProductionTicket(ticket, "kitchen", lang, w);
      for (const line of text.split("\n")) assert(line.length <= w, `regel breder dan ${w}: "${line}"`);
      assert(!/EUR|€/.test(text), "bedrag op een productiebon");
      assert(text.includes("-1 x Cola"), "annulering niet zichtbaar");
      assert(text.includes("B7"), "tafel ontbreekt");
    }
  }
});

Deno.test("betaalbewijs: niet geldig als kasticket, correcties weg, bedragen kloppen", () => {
  const m = receiptModelFromData(data);
  assert(m.lines.length === 1 && m.lines[0].name === "Pils", `correctie niet weggevallen: ${JSON.stringify(m.lines)}`);
  assert(m.tenders.length === 1, "lege betaalwijze getoond");
  assert(m.address.length === 2, "lege adresregel");
  for (const w of PRINT_WIDTHS) {
    const text = renderReceiptText(m, "nl", w);
    for (const line of text.split("\n")) assert(line.length <= w, `regel breder dan ${w}: "${line}"`);
    assert(text.includes("DIT IS GEEN GELDIG BTW-KASTICKET"), "vermelding ontbreekt");
    assert(text.includes("EUR 6,00") && text.includes("EUR 1,00") && text.includes("EUR 7,00"), "bedragen ontbreken");
  }
  const html = renderReceiptHtml(m, "fr");
  assert(html.includes("CECI N'EST PAS UN TICKET DE CAISSE TVA VALABLE".replace("'", "&#39;")), "vermelding ontbreekt in de mail");
  assert(!html.includes("<script"), "HTML niet ontsnapt");
});

Deno.test("deelbetaling en online: label en rest open", () => {
  const m = receiptModelFromData({ ...data, origin: "online", online_kind: "share", lines: [], rest_open: true });
  const text = renderReceiptText(m, "nl", 42);
  assert(text.includes("Jouw deel van de rekening") && text.includes("De rest van de rekening staat nog open."), text);
});

Deno.test("namen worden ontsnapt in de mail", () => {
  const m = receiptModelFromData({ ...data, lines: [{ quantity: 1, name: "<img src=x onerror=alert(1)>", total_cents: 100 }] });
  assert(!renderReceiptHtml(m, "nl").includes("<img"), "naam niet ontsnapt");
});

Deno.test("hulpfuncties", () => {
  assert(money(1250) === "EUR 12,50" && money(-5) === "-EUR 0,05" && money(0) === "EUR 0,00", "money");
  assert(wrap("a".repeat(70), 32).every((l) => l.length <= 32), "wrap knipt lange woorden");
  assert(mergeLines([{ quantity: 1, name: "A", total_cents: 100 }, { quantity: 1, name: "A", total_cents: 100 }])[0].quantity === 2, "samenvoegen");
  assert(isMailAddress("gast@voorbeeld.be") && !isMailAddress("a@b") && !isMailAddress("x@y.be, z@w.be") && !isMailAddress(""), "e-mailcontrole");
  const t = renderTestPage("Zaak", "Bar", "nl", 32);
  assert(t.split("\n").every((l) => l.length <= 32), "testpagina te breed");
});

Deno.test("online hele rekening na eerdere delen: eerder betaald staat erbij, lijnen min dat = totaal", () => {
  const m = receiptModelFromData({ ...data, origin: "online", online_kind: "full", lines: [{ quantity: 2, name: "Pils", total_cents: 600 }],
    paid_cents: 400, prepaid_cents: 200, tenders: [{ method: "online", amount_cents: 400 }] });
  const text = renderReceiptText(m, "nl", 42);
  assert(text.includes("Eerder online betaald") && text.includes("-EUR 2,00") && text.includes("EUR 4,00"), text);
  assert(renderReceiptHtml(m, "en").includes("Paid online earlier"), "mail mist eerder betaald");
});

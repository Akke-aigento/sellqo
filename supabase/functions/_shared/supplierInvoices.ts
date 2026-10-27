// INKOOP-2 — bol.com-facturen via de Retailer API (lijst, vensters, Odoo-actieantwoord).
// Sinds INKOOP-3 schrijft import-supplier-invoices ze eerst in SellQo (supplier_documents)
// en stuurt ze daarna naar Odoo: zie _shared/supplierInbox.ts. Oorspronkelijk:
// leveranciersfacturen die enkel via een API bestaan, als concept in het
// aankoopdagboek van Odoo (nomadix-bv). Eerste bron: bol.com (VanXcel-koppeling).
//
// Werkwijze = exact wat Akke tot nu manueel deed: de PDF uploaden in het aankoopdagboek
// (account.journal.create_document_from_attachment, de knop "Uploaden"). Odoo maakt een
// concept, de OCR vult leverancier, datum en regels, Pieter keurt goed.
// SellQo vult bewust GEEN bedragen in: bol's ALL_IN_ONE-factuur verrekent omzet met kosten,
// en Pieter boekt die anders dan het payableAmount (gemeten 27-10: bol −35,77 → Odoo 20,13).
//
// Nooit dubbel: een factuur wordt overgeslagen als (a) supplier_invoice_imports haar al kent,
// of (b) Odoo al een aankoopfactuur/-creditnota heeft met Referentie = het bol-factuurnummer
// (zo zitten de 46 manueel geüploade bol-facturen er al in). Enkel concepten, nooit boeken.

/* eslint-disable @typescript-eslint/no-explicit-any -- structurele clients */

export const INKOOP_VERSION = "INKOOP-2b";

export interface BolInvoiceItem {
  invoiceId: string;
  issueDate: string;          // YYYY-MM-DD (Europe/Brussels)
  invoiceType: string;        // ALL_IN_ONE | ADVERTISING_VIA_BOL | …
  payable: number;            // payableAmount.amount (kan negatief zijn)
  hasPdf: boolean;
}

/** bol geeft epoch-milliseconden; de factuurdatum is de kalenderdag in Brussel. */
export function brusselsDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(ms));
}

export function parseBolInvoiceList(json: any): BolInvoiceItem[] {
  const items = Array.isArray(json?.invoiceListItems) ? json.invoiceListItems : [];
  return items
    .filter((i: any) => typeof i?.invoiceId === "string" && /^\d{6,20}$/.test(i.invoiceId))
    .map((i: any) => ({
      invoiceId: i.invoiceId,
      issueDate: typeof i.issueDate === "number" ? brusselsDate(i.issueDate) : String(i.issueDate ?? "").slice(0, 10),
      invoiceType: String(i.invoiceType ?? ""),
      payable: Number(i?.legalMonetaryTotal?.payableAmount?.amount ?? 0),
      hasPdf: (i?.invoiceMediaTypes?.availableMediaTypes ?? []).some((m: string) => /pdf/.test(m)),
    }));
}

/** Vensters van hoogstens 31 dagen (bol staat er max. 32 toe), van oud naar nieuw. */
export function dateWindows(today: string, days: number): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = [];
  const endAll = new Date(`${today}T00:00:00Z`);
  let start = new Date(endAll.getTime() - days * 86400000);
  while (start < endAll) {
    const end = new Date(Math.min(start.getTime() + 31 * 86400000, endAll.getTime()));
    out.push({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    start = end;
  }
  return out;
}

/** Het move-id uit het actie-antwoord van create_document_from_attachment. */
export function moveIdFromAction(action: any): number | null {
  if (typeof action?.res_id === "number" && action.res_id > 0) return action.res_id;
  const dom = action?.domain;
  if (Array.isArray(dom)) {
    for (const leaf of dom) {
      // Splitst Odoo de PDF in meerdere concepten, dan het eerste (het laagste id);
      // de andere hangen aan dezelfde bijlage en Pieter ziet ze in het dagboek.
      if (Array.isArray(leaf) && leaf[0] === "id" && leaf[1] === "in" && Array.isArray(leaf[2]) && leaf[2].length >= 1) {
        const ids = leaf[2].map(Number).filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
        return ids[0] ?? null;
      }
    }
  }
  return null;
}

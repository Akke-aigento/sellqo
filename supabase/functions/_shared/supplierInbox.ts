// INKOOP-3 — SellQo als facturen-inbox (supplier_documents), Odoo als bestemming.
//
// Stroom per document:
//   binnen (upload / e-mail / bol)  →  supplier_documents (odoo_status null)
//   push   →  concept in het Odoo-aankoopdagboek (zoals de knop Uploaden; OCR vult in)
//   pull   →  wat Odoo/Pieter ervan maakte terug naar SellQo (leverancier, nummer, datum,
//             bedragen, geboekt/betaald)
// Archief (eenmalig): bestaande Odoo-aankoopfacturen als document in SellQo.
//
// Nooit dubbel in Odoo:
//   1. claim in de databank (odoo_status → pending, met tijdstempel) vóór elke upload;
//   2. de bijlage heet sq-<document-id>.<ext>: een volgende poging vindt een eerder
//      concept terug op die naam, ook als de vorige poging halverwege stierf;
//   3. bol-facturen ook op Referentie = bol-nummer (de manuele uploads van vóór 27-10).
// SellQo vult in Odoo nooit bedragen in en boekt nooit: enkel concepten.

/* eslint-disable @typescript-eslint/no-explicit-any -- structurele clients en Odoo-records */

export const INBOX_VERSION = "INKOOP-3";

/** Een claim die langer dan dit "pending" staat, mag opnieuw (de vorige run stierf). */
export const CLAIM_STALE_MS = 15 * 60 * 1000;
export const MAX_PUSH_ATTEMPTS = 5;

export type OdooState = "draft" | "posted" | "cancel";

export interface OdooBill {
  id: number;
  move_type: string;          // in_invoice | in_refund
  state: OdooState;
  ref: string | false;
  invoice_date: string | false;
  invoice_date_due: string | false;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  payment_state: string | false; // not_paid | partial | in_payment | paid | reversed | invoicing_legacy
  partner_id: [number, string] | false;
  currency_id?: [number, string] | false;
}

export interface DocPatch {
  document_type?: "invoice" | "credit_note";
  document_number?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  amount?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  payment_status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
  paid_at?: string | null;
  paid_amount?: number;
  odoo_status: OdooState;
  odoo_error: null;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Wat Odoo van een aankoopfactuur maakte, als wijziging op het SellQo-document.
 * Een concept zonder OCR-resultaat (nog geen datum/bedrag) overschrijft niets wat
 * SellQo al wist: lege Odoo-velden blijven weg uit de patch.
 */
export function patchFromOdoo(bill: OdooBill, today: string, current?: { paid_at?: string | null }): DocPatch {
  const p: DocPatch = { odoo_status: bill.state, odoo_error: null };
  p.document_type = bill.move_type === "in_refund" ? "credit_note" : "invoice";
  if (bill.ref) p.document_number = String(bill.ref).slice(0, 200);
  if (bill.invoice_date) p.document_date = bill.invoice_date;
  if (bill.invoice_date_due) p.due_date = bill.invoice_date_due;
  if (bill.amount_total || bill.state !== "draft") {
    p.amount = r2(bill.amount_untaxed);
    p.tax_amount = r2(bill.amount_tax);
    p.total_amount = r2(bill.amount_total);
  }
  if (bill.currency_id && bill.currency_id[1]) p.currency = String(bill.currency_id[1]).slice(0, 3).toUpperCase();

  if (bill.state === "cancel" || bill.payment_state === "reversed") {
    p.payment_status = "cancelled";
  } else if (bill.state === "posted") {
    if (bill.payment_state === "paid" || bill.payment_state === "in_payment") {
      p.payment_status = "paid";
      p.paid_amount = r2(bill.amount_total);
      p.paid_at = current?.paid_at ?? new Date().toISOString();
    } else if (bill.payment_state === "partial") {
      p.payment_status = "partial";
    } else {
      p.payment_status = bill.invoice_date_due && bill.invoice_date_due < today ? "overdue" : "pending";
    }
  }
  return p;
}

/** Is dit document klaar met synchroniseren (geen pull meer nodig)? */
export function isSettled(doc: { odoo_status: string | null; payment_status: string | null }): boolean {
  return doc.odoo_status === "cancel" || (doc.odoo_status === "posted" && (doc.payment_status === "paid" || doc.payment_status === "cancelled"));
}

/** Bestandsnaam van de bijlage in Odoo: herkenbaar en uniek per document. */
export function odooFileName(docId: string, fileName: string | null | undefined): string {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(fileName ?? "")?.[1] ?? "pdf").toLowerCase();
  return `sq-${docId}.${ext}`;
}

/** Een Odoo-link naar de boeking (voor de knop "Open in Odoo"). */
export function odooMoveUrl(odooUrl: string, moveId: number): string {
  return `${odooUrl.replace(/\/+$/, "")}/odoo/action-account.action_move_in_invoice_type/${moveId}`;
}

/** Welke bijlagen van een e-mail zijn een factuur? (PDF of afbeelding, niet te groot) */
export function isInvoiceAttachment(a: { filename?: string | null; content_type?: string | null; size?: number | null }): boolean {
  const name = (a.filename ?? "").toLowerCase();
  const type = (a.content_type ?? "").toLowerCase();
  if (a.size != null && a.size > 15 * 1024 * 1024) return false;
  if (type === "application/pdf" || name.endsWith(".pdf")) return true;
  if (/^image\/(png|jpe?g|webp)$/.test(type) || /\.(png|jpe?g|webp)$/.test(name)) {
    // Kleine afbeeldingen zijn logo's en handtekeningen, geen facturen.
    return (a.size ?? 0) >= 30 * 1024;
  }
  return false;
}

export function mimeFor(fileName: string, fallback = "application/pdf"): string {
  const n = fileName.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  return fallback;  // "" = onbekend (zie invoiceMime)
}

/** Leverancier zoeken op Odoo-partner, anders op naam, anders aanmaken. */
export async function findOrCreateSupplier(db: { from(t: string): any }, tenantId: string, partner: [number, string]): Promise<string | null> {
  const [partnerId, rawName] = partner;
  const name = String(rawName ?? "").trim().slice(0, 200);
  if (!partnerId || !name) return null;
  const byPartner = await db.from("suppliers").select("id").eq("tenant_id", tenantId).eq("odoo_partner_id", partnerId).maybeSingle();
  if (byPartner.error) throw new Error(`suppliers: ${byPartner.error.message}`);
  if (byPartner.data?.id) return byPartner.data.id as string;
  const byName = await db.from("suppliers").select("id, odoo_partner_id").eq("tenant_id", tenantId).ilike("name", name).limit(1);
  if (byName.error) throw new Error(`suppliers: ${byName.error.message}`);
  const hit = (byName.data ?? [])[0];
  if (hit?.id && !hit.odoo_partner_id) {
    await db.from("suppliers").update({ odoo_partner_id: partnerId }).eq("id", hit.id);
    return hit.id as string;
  }
  if (hit?.id) return hit.id as string;
  const ins = await db.from("suppliers").insert({ tenant_id: tenantId, name, odoo_partner_id: partnerId, country: null }).select("id").single();
  if (ins.error) {
    // Gelijktijdig aangemaakt: opnieuw opzoeken.
    if ((ins.error as { code?: string }).code === "23505") {
      const again = await db.from("suppliers").select("id").eq("tenant_id", tenantId).eq("odoo_partner_id", partnerId).maybeSingle();
      return (again.data?.id as string) ?? null;
    }
    throw new Error(`leverancier aanmaken: ${ins.error.message}`);
  }
  return ins.data.id as string;
}

/** Archief: welke winkel krijgt een Odoo-aankoopfactuur, op leveranciersnaam. */
export function routeByPartner(partnerName: string, routes: Array<{ pattern: string; tenantId: string }>, fallback: string): string {
  const n = partnerName.toLowerCase();
  for (const r of routes) {
    try { if (new RegExp(r.pattern, "i").test(n)) return r.tenantId; } catch { /* ongeldige regex: overslaan */ }
  }
  return fallback;
}

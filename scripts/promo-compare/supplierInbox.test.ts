/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas */
// INKOOP-3/4 — inkoopfacturen: Odoo-terugsync, facturenadres, e-mail naar inbox.
// Run: deno test --allow-env --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/supplierInbox.test.ts
import {
  findOrCreateSupplier,
  isInvoiceAttachment,
  isSettled,
  odooFileName,
  patchFromOdoo,
  routeByPartner,
  type OdooBill,
} from "../../supabase/functions/_shared/supplierInbox.ts";
import { extractInboundAddress, extractInboundPrefix, invoiceInboxAddress } from "../../supabase/functions/_shared/inboundAddress.ts";
import { dmarcPassed, ingestInvoiceEmail, invoiceMime, isDuplicateReceipt, senderAddress, senderVerdict } from "../../supabase/functions/_shared/supplierInboxEmail.ts";
import { StatefulDb } from "./statefulDb.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

const T = "54f6b480-280b-42e1-b843-d5beb2831acd";
const bill = (o: Partial<OdooBill> = {}): OdooBill => ({
  id: 1602, move_type: "in_invoice", state: "posted", ref: "3916348598492", invoice_date: "2026-09-15",
  invoice_date_due: "2026-10-15", amount_untaxed: 10.83, amount_tax: 0, amount_total: 10.83,
  payment_state: "not_paid", partner_id: [49, "bol"], currency_id: [1, "EUR"], ...o,
});

Deno.test("terugsync: geboekt en betaald", () => {
  const p = patchFromOdoo(bill({ payment_state: "paid" }), "2026-10-27");
  eq([p.odoo_status, p.payment_status, p.paid_amount, p.document_number, p.total_amount, p.document_type],
    ["posted", "paid", 10.83, "3916348598492", 10.83, "invoice"], "betaald");
  eq(isSettled({ odoo_status: p.odoo_status, payment_status: p.payment_status ?? null }), true, "klaar");
});

Deno.test("terugsync: vervallen, deels, creditnota, geannuleerd", () => {
  eq(patchFromOdoo(bill(), "2026-10-27").payment_status, "overdue", "vervallen");
  eq(patchFromOdoo(bill(), "2026-10-01").payment_status, "pending", "nog niet vervallen");
  eq(patchFromOdoo(bill({ payment_state: "partial" }), "2026-10-27").payment_status, "partial", "deels");
  eq(patchFromOdoo(bill({ move_type: "in_refund" }), "2026-10-27").document_type, "credit_note", "creditnota");
  eq(patchFromOdoo(bill({ state: "cancel" }), "2026-10-27").payment_status, "cancelled", "geannuleerd");
});

Deno.test("terugsync: leeg concept overschrijft niets", () => {
  const p = patchFromOdoo(bill({ state: "draft", ref: false, invoice_date: false, invoice_date_due: false, amount_untaxed: 0, amount_tax: 0, amount_total: 0, payment_state: "not_paid" }), "2026-10-27");
  eq(Object.keys(p).sort(), ["currency", "document_type", "odoo_error", "odoo_status"], "enkel status");
  eq(isSettled({ odoo_status: "draft", payment_status: "pending" }), false, "concept is niet klaar");
});

Deno.test("bestandsnaam in Odoo en archiefroutering", () => {
  eq(odooFileName("abc", "Factuur 12.PDF"), "sq-abc.pdf", "extensie");
  eq(odooFileName("abc", null), "sq-abc.pdf", "standaard pdf");
  eq(odooFileName("abc", "scan.jpeg"), "sq-abc.jpeg", "afbeelding");
  const routes = [{ pattern: "^bol$|sendcloud|coolblue", tenantId: "VX" }, { pattern: "([", tenantId: "KAPOT" }];
  eq([routeByPartner("bol", routes, "SQ"), routeByPartner("Sendcloud B.V.", routes, "SQ"), routeByPartner("Lovable Labs", routes, "SQ"), routeByPartner("bolletje", routes, "SQ")],
    ["VX", "VX", "SQ", "SQ"], "routes");
});

Deno.test("facturenadres", () => {
  eq(extractInboundAddress("VanXcel <vanxcel+facturen@Mail.SellQo.app>"), { prefix: "vanxcel", tag: "facturen" }, "met tag");
  eq(extractInboundAddress("vanxcel@mail.sellqo.app"), { prefix: "vanxcel", tag: null }, "zonder tag");
  eq(extractInboundAddress("vanxcel+facturen@sellqo.app"), null, "verkeerd domein");
  eq(extractInboundAddress("vanxcel+fac/turen@mail.sellqo.app"), null, "rare tag");
  eq(extractInboundPrefix("vanxcel+facturen@mail.sellqo.app"), null, "oude parser blijft strikt");
  eq(invoiceInboxAddress("fonske-crawl"), "fonske-crawl+facturen@mail.sellqo.app", "adres");
});

Deno.test("bijlagen: PDF ja, logo nee", () => {
  eq(isInvoiceAttachment({ filename: "F-123.pdf", content_type: "application/octet-stream", size: 20_000 }), true, "pdf op naam");
  eq(isInvoiceAttachment({ filename: "logo.png", content_type: "image/png", size: 4_000 }), false, "klein logo");
  eq(isInvoiceAttachment({ filename: "scan.jpg", content_type: "image/jpeg", size: 400_000 }), true, "scan");
  eq(isInvoiceAttachment({ filename: "x.pdf", content_type: "application/pdf", size: 20 * 1024 * 1024 }), false, "te groot");
  eq(isInvoiceAttachment({ filename: "data.xlsx", content_type: "application/vnd.ms-excel", size: 50_000 }), false, "excel");
});

function storageFake() {
  const files: Record<string, number> = {};
  return { files, storage: { from: () => ({ upload: async (p: string, b: Uint8Array) => { files[p] = b.length; return { error: null }; } }) } };
}

Deno.test("e-mail → leveranciersdocumenten, herhaling geeft geen dubbels", async () => {
  const db = new StatefulDb({ supplier_documents: [], supplier_inbox_settings: [], supplier_inbox_senders: [], notifications: [] });
  const st = storageFake();
  const client: any = { from: (t: string) => db.from(t), storage: st.storage };
  // Unieke index (tenant_id, external_id) zoals in de databank.
  const origInsert = db.from.bind(db);
  client.from = (t: string) => {
    const q: any = origInsert(t);
    if (t !== "supplier_documents") return q;
    const ins = q.insert.bind(q);
    q.insert = (row: any) => {
      if (db.tables.supplier_documents.some((r) => r.tenant_id === row.tenant_id && r.external_id === row.external_id)) {
        return { then: (res: any) => res({ error: { code: "23505", message: "dubbel" } }) };
      }
      return ins(row);
    };
    return q;
  };
  const opts = {
    supabase: client, tenantId: T, emailId: "em1", from: "Lovable <billing@lovable.dev>", subject: "Your receipt", authenticated: true,
    listAttachments: async () => [
      { id: "a1", filename: "Receipt-2901.pdf", size: 40_000, content_type: "application/pdf", download_url: "u1" },
      { id: "a2", filename: "logo.png", size: 3_000, content_type: "image/png", download_url: "u2" },
    ],
    download: async () => new Uint8Array([37, 80, 68, 70, 45]),
  };
  const r = await ingestInvoiceEmail(opts);
  eq([r.stored, r.skipped, r.errors.length], [1, 1, 0], "één factuur, logo overgeslagen");
  const doc = db.tables.supplier_documents[0];
  eq([doc.source, doc.external_id, doc.supplier_id, doc.document_type, doc.storage_path],
    ["email", "email:em1:a1", null, "invoice", `${T}/inbox/em1/a1-Receipt-2901.pdf`], "document");
  // INKOOP-6: onbekende afzender + geen instelling = standaard controleren.
  eq([r.verdict, doc.sender_email, doc.review_status], ["review", "billing@lovable.dev", "pending"], "te controleren");
  eq([db.tables.notifications.length, db.tables.notifications[0].type], [1, "supplier_invoice_review"], "één melding");
  const r2 = await ingestInvoiceEmail(opts);
  eq([r2.stored, r2.fresh, db.tables.supplier_documents.length], [1, 0, 1], "herhaling: geen tweede rij");
  eq(db.tables.notifications.length, 1, "herhaling: geen tweede melding");
});

Deno.test("afzender: adres uit de From-regel en het oordeel", () => {
  eq(senderAddress("Akke Mercken <A.Aigento@Outlook.com>"), "a.aigento@outlook.com", "naam + adres");
  eq(senderAddress("billing@lovable.dev"), "billing@lovable.dev", "enkel adres");
  eq(senderAddress("Onbekend"), null, "geen adres");
  eq(senderVerdict({ requireApproval: true, sender: "x@y.be", status: null, authenticated: true }), "review", "onbekend → controleren");
  eq(senderVerdict({ requireApproval: true, sender: "x@y.be", status: "approved", authenticated: true }), "trusted", "vertrouwd + DMARC");
  eq(senderVerdict({ requireApproval: true, sender: "x@y.be", status: "approved", authenticated: false }), "review", "vertrouwd maar vervalst/onbewezen → controleren");
  eq(senderVerdict({ requireApproval: false, sender: null, status: null, authenticated: false }), "trusted", "controle uit");
  eq(senderVerdict({ requireApproval: false, sender: "x@y.be", status: "blocked", authenticated: true }), "blocked", "geblokkeerd, ook met controle uit");
  eq([dmarcPassed({ dmarc: "pass" }), dmarcPassed({ dmarc: "fail" }), dmarcPassed(null), dmarcPassed({ dmarc: "unknown" })], [true, false, false, false], "dmarc");
});

Deno.test("e-mail: vertrouwde afzender gaat door, geblokkeerde komt niet binnen", async () => {
  const mk = (status: "approved" | "blocked") => new StatefulDb({
    supplier_documents: [], notifications: [], supplier_inbox_settings: [],
    supplier_inbox_senders: [{ id: "s", tenant_id: T, email: "a.aigento@outlook.com", status }],
  });
  const att = async () => [{ id: "a1", filename: "Invoice-1.pdf", size: 40_000, content_type: "application/pdf", download_url: "u" }];
  const run = (db: StatefulDb) => ingestInvoiceEmail({
    supabase: { from: (t: string) => db.from(t), storage: storageFake().storage } as any, tenantId: T, emailId: "em2",
    from: "Akke <a.aigento@outlook.com>", subject: "Fwd: invoice", authenticated: true, listAttachments: att, download: async () => new Uint8Array([1]),
  });
  const ok = mk("approved");
  const r = await run(ok);
  eq([r.verdict, ok.tables.supplier_documents[0].review_status, ok.tables.notifications[0].type],
    ["trusted", null, "supplier_invoice_received"], "vertrouwd");
  const bad = mk("blocked");
  const r2 = await run(bad);
  eq([r2.verdict, r2.stored, bad.tables.supplier_documents.length, bad.tables.notifications.length], ["blocked", 0, 0, 0], "geblokkeerd");
});

Deno.test("leverancier: op Odoo-partner, dan naam (koppelt), dan nieuw", async () => {
  const db = new StatefulDb({ suppliers: [{ id: "s1", tenant_id: T, name: "Bol", odoo_partner_id: null }] });
  eq(await findOrCreateSupplier(db as any, T, [49, "bol"]), "s1", "op naam, hoofdletterongevoelig");
  eq(db.tables.suppliers[0].odoo_partner_id, 49, "partner gekoppeld");
  eq(await findOrCreateSupplier(db as any, T, [49, "bol.com B.V."]), "s1", "daarna op partner");
  const id = await findOrCreateSupplier(db as any, T, [77, "Lovable Labs Incorporated"]);
  eq([db.tables.suppliers.length, db.tables.suppliers[1].name, db.tables.suppliers[1].odoo_partner_id, typeof id], [2, "Lovable Labs Incorporated", 77, "string"], "nieuw");
  eq(await findOrCreateSupplier(db as any, T, [0, ""]), null, "geen partner");
});

Deno.test("type van een mailbijlage: wat de bucket aanvaardt", () => {
  eq(invoiceMime("F-1.pdf", "application/octet-stream"), "application/pdf", "pdf op extensie");
  eq(invoiceMime("scan.JPG", "image/jpg"), "image/jpeg", "jpg");
  eq(invoiceMime("factuur", "image/jpg"), "image/jpeg", "zonder extensie, jpg rechtgezet");
  eq(invoiceMime("factuur", "application/octet-stream"), "application/pdf", "onbekend = pdf");
});

Deno.test("Stripe-mail: factuur + ontvangstbewijs = één uitgave", () => {
  const names = ["Invoice-VSMSHUYQ-0017.pdf", "Receipt-2672-0718-7096.pdf"];
  eq(isDuplicateReceipt(names[1], names), true, "ontvangstbewijs naast factuur");
  eq(isDuplicateReceipt(names[0], names), false, "de factuur zelf");
  eq(isDuplicateReceipt("Receipt-1.pdf", ["Receipt-1.pdf"]), false, "enkel een ontvangstbewijs: wel boeken");
  eq(isDuplicateReceipt("receipts-overview.pdf", names), false, "geen echte receipt-naam");
});

// INKOOP-4 — mail aan `<winkel>+facturen@mail.sellqo.app` wordt een inkoopfactuur.
//
// Elke PDF (of grote afbeelding) in de mail wordt een leveranciersdocument (bron e-mail,
// leverancier nog leeg = "te verwerken"). Heeft de winkel "naar Odoo" aan, dan stuurt de
// trigger op supplier_documents het meteen als concept door. De mail komt NIET in de
// klantberichten. Webhook-herhalingen geven geen dubbels: extern id = email:<id>:<bijlage>.

/* eslint-disable @typescript-eslint/no-explicit-any -- structurele client */
import { isInvoiceAttachment, mimeFor } from "./supplierInbox.ts";

/** Wat de bucket supplier-documents aanvaardt (ook voor de service role). */
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
/** Type uit de extensie; enkel als die niets zegt, het opgegeven type (als het mag). */
export function invoiceMime(name: string, contentType: string | null | undefined): string {
  const byExt = mimeFor(name, "");
  if (byExt) return byExt;
  const ct = (contentType ?? "").toLowerCase().replace("image/jpg", "image/jpeg");
  return ALLOWED_MIME.has(ct) ? ct : "application/pdf";
}

export interface InboundAttachment {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  download_url: string;
}

export interface InvoiceEmailResult {
  tenantId: string;
  stored: number;
  skipped: number;
  errors: string[];
}

const BUCKET = "supplier-documents";
const MAX_FILES = 10;

function safeName(name: string): string {
  return (name || "factuur.pdf").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "factuur.pdf";
}

export async function ingestInvoiceEmail(opts: {
  supabase: { from(t: string): any; storage: any };
  tenantId: string;
  emailId: string;
  from: string;
  subject: string;
  listAttachments: () => Promise<InboundAttachment[]>;
  download: (url: string) => Promise<Uint8Array>;
}): Promise<InvoiceEmailResult> {
  const { supabase, tenantId, emailId } = opts;
  const res: InvoiceEmailResult = { tenantId, stored: 0, skipped: 0, errors: [] };
  const all = await opts.listAttachments();
  const invoices = all.filter(isInvoiceAttachment).slice(0, MAX_FILES);
  res.skipped = all.length - invoices.length;

  for (const a of invoices) {
    try {
      const bytes = await opts.download(a.download_url);
      if (!bytes.length) throw new Error("lege bijlage");
      const name = safeName(a.filename);
      const path = `${tenantId}/inbox/${emailId}/${a.id}-${name}`;
      const mime = invoiceMime(name, a.content_type);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
      if (upErr) throw new Error(`opslaan: ${upErr.message}`);
      const { error: insErr } = await supabase.from("supplier_documents").insert({
        tenant_id: tenantId, supplier_id: null, source: "email", external_id: `email:${emailId}:${a.id}`,
        document_type: "invoice", file_name: name, file_url: path, file_size: bytes.length, mime_type: mime,
        storage_path: path, currency: "EUR",
        notes: `Van ${opts.from.slice(0, 200)} — ${opts.subject.slice(0, 200)}`,
        extracted_data: { email: { from: opts.from.slice(0, 300), subject: opts.subject.slice(0, 300), email_id: emailId } },
      });
      if (insErr && (insErr as { code?: string }).code !== "23505") throw new Error(insErr.message);
      res.stored++;
    } catch (e) {
      res.errors.push(`${a.filename}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}

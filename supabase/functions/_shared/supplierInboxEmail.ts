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

/**
 * Stripe-mails (Anthropic, Lovable, OpenAI, …) sturen een factuur én een ontvangstbewijs van
 * dezelfde betaling. Zit er een factuur bij, dan is een ontvangstbewijs geen tweede uitgave:
 * bewaren als "overig", niet naar Odoo (27-10: Anthropic VSMSHUYQ-0017 kwam twee keer binnen).
 */
export function isDuplicateReceipt(name: string, allNames: string[]): boolean {
  const isReceipt = (n: string) => /^(receipt|ontvangstbewijs|quittung|re[çc]u)[-_ ]/i.test(n);
  const isInvoice = (n: string) => /^(invoice|factuur|rechnung|facture)[-_ ]/i.test(n);
  return isReceipt(name) && allNames.some(isInvoice);
}

/** "Naam <adres@x>" → "adres@x" (kleine letters); null als er geen adres in staat. */
export function senderAddress(from: string | null | undefined): string | null {
  const raw = (/<([^>]+)>/.exec(from ?? "")?.[1] ?? from ?? "").trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(raw) ? raw : null;
}

/**
 * INKOOP-6: mag mail van deze afzender meteen door, moet ze gecontroleerd worden, of
 * komt ze niet binnen? Het adres is te raden; zonder controle kon iedereen een pdf als
 * concept in de Odoo van een winkel zetten. De From-regel is te vervalsen: een vertrouwde
 * afzender telt enkel als DMARC slaagde (uitslag van de ontvangende server van Resend,
 * niet van de mail zelf). Anders: controleren.
 */
export type SenderVerdict = "trusted" | "review" | "blocked";
export function senderVerdict(opts: {
  requireApproval: boolean;
  sender: string | null;
  status: "approved" | "blocked" | null;
  authenticated: boolean;
}): SenderVerdict {
  if (opts.status === "blocked") return "blocked";
  if (!opts.requireApproval) return "trusted";
  return opts.status === "approved" && opts.authenticated ? "trusted" : "review";
}

/** Resend `authentication` (spf/dkim/dmarc): enkel dmarc = pass bewijst dat de afzender klopt. */
export function dmarcPassed(auth: { dmarc?: string | null } | null | undefined): boolean {
  return String(auth?.dmarc ?? "").toLowerCase() === "pass";
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
  /** Nieuw opgeslagen in deze aanroep (niet bij een webhook-herhaling). */
  fresh: number;
  skipped: number;
  verdict: SenderVerdict;
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
  /** DMARC geslaagd volgens Resend (zie dmarcPassed). */
  authenticated: boolean;
  listAttachments: () => Promise<InboundAttachment[]>;
  download: (url: string) => Promise<Uint8Array>;
}): Promise<InvoiceEmailResult> {
  const { supabase, tenantId, emailId } = opts;
  const sender = senderAddress(opts.from);
  const [settingsRes, senderRes] = await Promise.all([
    supabase.from("supplier_inbox_settings").select("require_sender_approval").eq("tenant_id", tenantId).maybeSingle(),
    sender
      ? supabase.from("supplier_inbox_senders").select("status").eq("tenant_id", tenantId).eq("email", sender).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (settingsRes.error) throw new Error(`inbox-instellingen: ${settingsRes.error.message}`);
  if (senderRes.error) throw new Error(`afzenders: ${senderRes.error.message}`);
  const verdict = senderVerdict({
    // Geen rij = standaard: controleren.
    requireApproval: settingsRes.data?.require_sender_approval ?? true,
    sender,
    status: (senderRes.data?.status as "approved" | "blocked" | undefined) ?? null,
    authenticated: opts.authenticated,
  });
  const res: InvoiceEmailResult = { tenantId, stored: 0, fresh: 0, skipped: 0, verdict, errors: [] };
  if (verdict === "blocked") {
    console.log(`facturen-inbox ${tenantId}: afzender ${sender} geblokkeerd, mail ${emailId} genegeerd`);
    return res;
  }
  const all = await opts.listAttachments();
  const invoices = all.filter(isInvoiceAttachment).slice(0, MAX_FILES);
  res.skipped = all.length - invoices.length;

  const names = invoices.map((a) => a.filename ?? "");
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
        document_type: isDuplicateReceipt(a.filename ?? "", names) ? "other" : "invoice", file_name: name, file_url: path, file_size: bytes.length, mime_type: mime,
        storage_path: path, currency: "EUR",
        sender_email: sender, sender_authenticated: opts.authenticated, review_status: verdict === "review" ? "pending" : null,
        notes: `Van ${opts.from.slice(0, 200)} — ${opts.subject.slice(0, 200)}`,
        extracted_data: { email: { from: opts.from.slice(0, 300), subject: opts.subject.slice(0, 300), email_id: emailId } },
      });
      if (insErr && (insErr as { code?: string }).code !== "23505") throw new Error(insErr.message);
      res.stored++;
      if (!insErr) res.fresh++;
    } catch (e) {
      res.errors.push(`${a.filename}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (res.fresh > 0) await notifyReceived(supabase, tenantId, emailId, sender, opts.subject, res.fresh, verdict);
  return res;
}

/** Eén melding per mail (niet per bijlage); de voorkeuren per type beslissen over mail/push. */
async function notifyReceived(
  supabase: { from(t: string): any }, tenantId: string, emailId: string, sender: string | null,
  subject: string, count: number, verdict: SenderVerdict,
): Promise<void> {
  const review = verdict === "review";
  const who = sender ?? "onbekende afzender";
  const { error } = await supabase.from("notifications").insert({
    tenant_id: tenantId,
    category: "invoices",
    type: review ? "supplier_invoice_review" : "supplier_invoice_received",
    priority: review ? "high" : "medium",
    title: review
      ? `Inkoopfactuur te controleren (${who})`
      : count === 1 ? "Nieuwe inkoopfactuur ontvangen" : `${count} nieuwe inkoopfacturen ontvangen`,
    message: review
      ? `Mail van een afzender die je nog niet vertrouwt: "${subject.slice(0, 120)}". Keur ze goed of weiger ze bij Leveranciersdocumenten; tot dan gaat ze niet naar Odoo.`
      : `Van ${who}: "${subject.slice(0, 120)}".`,
    data: { email_id: emailId, sender, count, review, dedupe_key: `supplier_mail:${emailId}` },
    action_url: "/admin/supplier-documents",
  });
  // Een melding mag de factuur nooit tegenhouden.
  if (error && (error as { code?: string }).code !== "23505") console.error("melding inkoopfactuur:", error.message);
}

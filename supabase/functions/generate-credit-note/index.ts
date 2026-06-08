import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "nl" | "en" | "fr" | "de";

const HEADER: Record<Lang, string> = {
  nl: "CREDITNOTA",
  en: "CREDIT NOTE",
  fr: "NOTE DE CRÉDIT",
  de: "GUTSCHRIFT",
};

const T: Record<string, Record<Lang, string>> = {
  ref: {
    nl: "Met betrekking tot factuur",
    en: "Regarding invoice",
    fr: "Concernant la facture",
    de: "Bezugnehmend auf Rechnung",
  },
  refOf: { nl: "van", en: "dated", fr: "du", de: "vom" },
  refOriginalAmount: {
    nl: "oorspronkelijk bedrag",
    en: "original amount",
    fr: "montant initial",
    de: "ursprünglicher Betrag",
  },
  number: { nl: "Creditnota-nummer", en: "Credit note number", fr: "N° de note de crédit", de: "Gutschriftnummer" },
  date: { nl: "Datum", en: "Date", fr: "Date", de: "Datum" },
  recipient: { nl: "Geadresseerde", en: "Recipient", fr: "Destinataire", de: "Empfänger" },
  reason: { nl: "Reden voor creditering", en: "Reason for credit", fr: "Motif du crédit", de: "Grund der Gutschrift" },
  description: { nl: "Omschrijving", en: "Description", fr: "Description", de: "Beschreibung" },
  qty: { nl: "Aantal", en: "Qty", fr: "Qté", de: "Menge" },
  vat: { nl: "BTW%", en: "VAT%", fr: "TVA%", de: "MwSt%" },
  unit: { nl: "Prijs", en: "Price", fr: "Prix", de: "Preis" },
  lineTotal: { nl: "Te crediteren", en: "To credit", fr: "À créditer", de: "Gutzuschreiben" },
  subtotal: { nl: "Subtotaal", en: "Subtotal", fr: "Sous-total", de: "Zwischensumme" },
  vatLabel: { nl: "BTW", en: "VAT", fr: "TVA", de: "MwSt" },
  totalCredit: { nl: "Totaal te crediteren", en: "Total to credit", fr: "Total à créditer", de: "Gesamt gutzuschreiben" },
  vatNotice: { nl: "BTW-vermelding", en: "VAT note", fr: "Mention TVA", de: "MwSt-Hinweis" },
  typeFull: { nl: "Volledige creditering", en: "Full credit", fr: "Crédit total", de: "Vollständige Gutschrift" },
  typePartial: { nl: "Gedeeltelijke creditering", en: "Partial credit", fr: "Crédit partiel", de: "Teilweise Gutschrift" },
  typeCorrection: { nl: "Correctie", en: "Correction", fr: "Correction", de: "Korrektur" },
  refundIssued: {
    nl: "Terugbetaling reeds uitgevoerd via Stripe",
    en: "Refund already processed via Stripe",
    fr: "Remboursement déjà effectué via Stripe",
    de: "Rückerstattung bereits über Stripe ausgeführt",
  },
  refundPending: {
    nl: "Terugbetaling in behandeling",
    en: "Refund pending",
    fr: "Remboursement en cours",
    de: "Rückerstattung ausstehend",
  },
};

const VAT_TEXTS: Record<string, Record<Lang, string>> = {
  intracom_goods: {
    nl: "Intracommunautaire levering vrijgesteld van BTW - art. 138 BTW-richtlijn 2006/112/EG",
    en: "Intra-Community supply exempt from VAT - Art. 138 VAT Directive 2006/112/EC",
    fr: "Livraison intracommunautaire exonérée de TVA - Art. 138 Directive TVA 2006/112/CE",
    de: "Innergemeinschaftliche Lieferung umsatzsteuerfrei - Art. 138 MwSt-Richtlinie 2006/112/EG",
  },
  intracom_services: {
    nl: "BTW verlegd naar afnemer - art. 196 BTW-richtlijn 2006/112/EG",
    en: "VAT reverse charged to customer - Art. 196 VAT Directive 2006/112/EC",
    fr: "TVA autoliquidée par le preneur - Art. 196 Directive TVA 2006/112/CE",
    de: "Steuerschuldnerschaft des Leistungsempfängers - Art. 196 MwSt-Richtlinie 2006/112/EG",
  },
  export_outside_eu: {
    nl: "Uitvoer vrijgesteld van BTW - art. 146 BTW-richtlijn 2006/112/EG",
    en: "Export exempt from VAT - Art. 146 VAT Directive 2006/112/EC",
    fr: "Exportation exonérée de TVA - Art. 146 Directive TVA 2006/112/CE",
    de: "Ausfuhr umsatzsteuerfrei - Art. 146 MwSt-Richtlinie 2006/112/EG",
  },
  oss_b2c_eu: {
    nl: "BTW berekend volgens OSS-regeling (One-Stop-Shop)",
    en: "VAT calculated under OSS scheme (One-Stop-Shop)",
    fr: "TVA calculée selon le régime OSS (guichet unique)",
    de: "MwSt berechnet nach OSS-Regelung (One-Stop-Shop)",
  },
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(Number(n) || 0);
}

function pickLang(input: unknown, customer: any, tenant: any): Lang {
  const allowed: Lang[] = ["nl", "en", "fr", "de"];
  if (typeof input === "string" && allowed.includes(input as Lang)) return input as Lang;
  const cl = (customer?.preferred_language || "").toLowerCase();
  if (allowed.includes(cl as Lang)) return cl as Lang;
  const tl = (tenant?.default_invoice_language || tenant?.language || "").toLowerCase();
  if (allowed.includes(tl as Lang)) return tl as Lang;
  return "nl";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { credit_note_id, language, auto_send_email } = body as { credit_note_id?: string; language?: Lang; auto_send_email?: boolean };
    if (!credit_note_id) {
      return new Response(JSON.stringify({ success: false, error: "credit_note_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cn, error: cnErr } = await admin
      .from("credit_notes")
      .select(`
        *,
        original_invoice:invoices!original_invoice_id(*),
        customer:customers(*),
        lines:credit_note_lines(*)
      `)
      .eq("id", credit_note_id)
      .maybeSingle();

    if (cnErr || !cn) throw new Error(cnErr?.message || "Credit note not found");

    const auth = await authenticateRequest(req, cn.tenant_id);
    requireRole(auth, cn.tenant_id, ["tenant_admin", "staff", "accountant"]);

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .select("*")
      .eq("id", cn.tenant_id)
      .single();
    if (tErr || !tenant) throw new Error("Tenant not found");

    const lang = pickLang(language, cn.customer, tenant);
    const currency = tenant.currency || "EUR";

    // ---- PDF ----
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width } = page.getSize();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const text = rgb(0.12, 0.12, 0.12);
    const gray = rgb(0.45, 0.45, 0.45);
    const accent = rgb(0.86, 0.2, 0.27); // credit = red accent
    const margin = 50;
    let y = 800;

    // Header
    page.drawText(String(tenant.name || ""), { x: margin, y, size: 16, font: bold, color: text });
    page.drawText(HEADER[lang], { x: width - margin - 220, y, size: 22, font: bold, color: accent });
    y -= 22;
    page.drawText(String(cn.credit_note_number), { x: width - margin - 220, y, size: 12, font: helv, color: gray });

    // Tenant address block
    y -= 30;
    const tLines = [
      tenant.address_line1,
      [tenant.postal_code, tenant.city].filter(Boolean).join(" "),
      tenant.country,
      tenant.vat_number ? `BTW: ${tenant.vat_number}` : null,
      tenant.email,
    ].filter(Boolean) as string[];
    for (const l of tLines) {
      page.drawText(l, { x: margin, y, size: 10, font: helv, color: gray });
      y -= 12;
    }

    // Recipient
    y -= 18;
    page.drawText(T.recipient[lang], { x: margin, y, size: 10, font: bold, color: text });
    y -= 14;
    const c = cn.customer || {};
    const cName = c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "-";
    const cLines = [
      cName,
      c.billing_address_line1 || c.address_line1,
      [c.billing_postal_code || c.postal_code, c.billing_city || c.city].filter(Boolean).join(" "),
      c.billing_country || c.country,
      c.vat_number ? `BTW: ${c.vat_number}` : null,
      c.email,
    ].filter(Boolean) as string[];
    for (const l of cLines) {
      page.drawText(String(l), { x: margin, y, size: 10, font: helv, color: text });
      y -= 12;
    }

    // Meta box
    y -= 18;
    page.drawText(`${T.number[lang]}:`, { x: margin, y, size: 10, font: helv, color: gray });
    page.drawText(String(cn.credit_note_number), { x: margin + 130, y, size: 10, font: bold, color: text });
    page.drawText(`${T.date[lang]}:`, { x: width / 2, y, size: 10, font: helv, color: gray });
    page.drawText(String(cn.issue_date), { x: width / 2 + 100, y, size: 10, font: bold, color: text });
    y -= 14;
    const typeLabel =
      cn.type === "full" ? T.typeFull[lang] : cn.type === "partial" ? T.typePartial[lang] : T.typeCorrection[lang];
    page.drawText("Type:", { x: margin, y, size: 10, font: helv, color: gray });
    page.drawText(typeLabel, { x: margin + 130, y, size: 10, font: helv, color: text });

    // Reference to original invoice
    const inv = cn.original_invoice;
    if (inv) {
      y -= 24;
      const refLine = `${T.ref[lang]} ${inv.invoice_number} ${T.refOf[lang]} ${inv.created_at?.slice(0, 10) || ""} (${T.refOriginalAmount[lang]}: ${fmt(inv.total, currency)})`;
      page.drawText(refLine, { x: margin, y, size: 10, font: helv, color: text });
    }

    // Reason
    if (cn.reason) {
      y -= 22;
      page.drawText(`${T.reason[lang]}:`, { x: margin, y, size: 10, font: bold, color: text });
      y -= 14;
      const wrap = String(cn.reason).match(/.{1,90}(\s|$)/g) || [String(cn.reason)];
      for (const w of wrap.slice(0, 4)) {
        page.drawText(w.trim(), { x: margin, y, size: 10, font: helv, color: text });
        y -= 12;
      }
    }

    // Lines table
    y -= 18;
    page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 20, color: rgb(0.95, 0.95, 0.97) });
    page.drawText(T.description[lang], { x: margin + 8, y, size: 10, font: bold, color: text });
    page.drawText(T.qty[lang], { x: 320, y, size: 10, font: bold, color: text });
    page.drawText(T.vat[lang], { x: 370, y, size: 10, font: bold, color: text });
    page.drawText(T.unit[lang], { x: 420, y, size: 10, font: bold, color: text });
    page.drawText(T.lineTotal[lang], { x: 490, y, size: 10, font: bold, color: text });
    y -= 18;

    const lines = (cn.lines || []) as any[];
    for (const ln of lines) {
      const desc = String(ln.description || "").substring(0, 42);
      const qty = Number(ln.quantity || 1);
      const rate = Number(ln.vat_rate || 0);
      const unit = Math.abs(Number(ln.unit_price || 0));
      const total = Math.abs(Number(ln.line_total || 0));
      page.drawText(desc, { x: margin + 8, y, size: 10, font: helv, color: text });
      page.drawText(String(qty), { x: 320, y, size: 10, font: helv, color: text });
      page.drawText(`${rate}%`, { x: 370, y, size: 10, font: helv, color: text });
      page.drawText(fmt(unit, currency), { x: 420, y, size: 10, font: helv, color: text });
      page.drawText(fmt(total, currency), { x: 490, y, size: 10, font: helv, color: text });
      y -= 14;
      if (y < 180) break;
    }

    // Totals
    y -= 10;
    const totalsX = 380;
    page.drawText(T.subtotal[lang], { x: totalsX, y, size: 10, font: helv, color: text });
    page.drawText(fmt(Math.abs(Number(cn.subtotal || 0)), currency), { x: 490, y, size: 10, font: helv, color: text });
    y -= 14;
    if (Number(cn.tax_amount || 0) !== 0) {
      page.drawText(T.vatLabel[lang], { x: totalsX, y, size: 10, font: helv, color: text });
      page.drawText(fmt(Math.abs(Number(cn.tax_amount || 0)), currency), { x: 490, y, size: 10, font: helv, color: text });
      y -= 14;
    }
    page.drawRectangle({ x: totalsX - 6, y: y - 6, width: width - margin - totalsX + 6, height: 22, color: rgb(0.97, 0.93, 0.94) });
    page.drawText(T.totalCredit[lang], { x: totalsX, y, size: 12, font: bold, color: accent });
    page.drawText(fmt(Math.abs(Number(cn.total || 0)), currency), { x: 490, y, size: 12, font: bold, color: accent });

    // VAT regime notice — reuse original invoice regime if present
    y -= 36;
    const regime = (inv as any)?.vat_regime as string | undefined;
    if (regime && VAT_TEXTS[regime]?.[lang]) {
      const note = `${T.vatNotice[lang]}: ${VAT_TEXTS[regime][lang]}`;
      const wrapped = note.match(/.{1,95}(\s|$)/g) || [note];
      for (const w of wrapped) {
        page.drawText(w.trim(), { x: margin, y, size: 9, font: helv, color: gray });
        y -= 11;
      }
    }

    // Refund status
    if (inv?.payment_status === "refunded" || cn.status === "processed") {
      y -= 6;
      page.drawText(T.refundIssued[lang], { x: margin, y, size: 9, font: bold, color: gray });
    } else {
      y -= 6;
      page.drawText(T.refundPending[lang], { x: margin, y, size: 9, font: helv, color: gray });
    }

    const pdfBytes = await pdfDoc.save();

    // Upload to private bucket
    const safeNumber = String(cn.credit_note_number).replace(/[^a-zA-Z0-9-]/g, "_");
    const path = `${cn.tenant_id}/${safeNumber}.pdf`;
    const { error: upErr } = await admin.storage
      .from("credit-notes")
      .upload(path, new Blob([pdfBytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    // Signed URL (24h)
    const { data: signed, error: signErr } = await admin.storage
      .from("credit-notes")
      .createSignedUrl(path, 60 * 60 * 24);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message || "Sign URL failed");
    const pdfUrl = signed.signedUrl;

    // Persist pdf_url + language
    const { data: updated, error: updErr } = await admin
      .from("credit_notes")
      .update({ pdf_url: pdfUrl, language: lang })
      .eq("id", cn.id)
      .select(`*, original_invoice:invoices!original_invoice_id(id, invoice_number, total, customer_id), customer:customers(id, first_name, last_name, email, company_name), lines:credit_note_lines(*)`)
      .single();
    if (updErr) throw new Error(updErr.message);

    // Audit log
    if (auth.user_id !== "service_role") {
      await admin.from("admin_actions_log").insert({
        tenant_id: cn.tenant_id,
        user_id: auth.user_id,
        action_type: "credit_note_pdf_generated",
        action_details: { credit_note_id: cn.id, language: lang, credit_note_number: cn.credit_note_number },
      });
    }

    return new Response(JSON.stringify({ success: true, pdf_url: pdfUrl, credit_note: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("[generate-credit-note] error", error?.message, error?.stack);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
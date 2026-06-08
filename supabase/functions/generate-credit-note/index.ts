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

function customerDisplayName(c: any, lang: Lang): string {
  const first = (c?.first_name || "").trim();
  const last = (c?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (c?.company_name) return String(c.company_name);
  const fallback: Record<Lang, string> = {
    nl: "Particuliere klant",
    en: "Private customer",
    fr: "Client particulier",
    de: "Privatkunde",
  };
  return fallback[lang];
}

async function tryEmbedLogo(pdfDoc: any, admin: any, tenant: any): Promise<any | null> {
  try {
    const url: string | undefined = tenant?.logo_url;
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("png")) return await pdfDoc.embedPng(bytes);
    if (ct.includes("jpg") || ct.includes("jpeg")) return await pdfDoc.embedJpg(bytes);
    try { return await pdfDoc.embedPng(bytes); } catch { return await pdfDoc.embedJpg(bytes); }
  } catch { return null; }
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
    pdfDoc.setTitle(`Credit Note ${cn.credit_note_number}`);
    pdfDoc.setAuthor(tenant.name || "");
    pdfDoc.setSubject(`Credit Note ${cn.credit_note_number}`);
    pdfDoc.setProducer("Sellqo Credit Note Generator");
    pdfDoc.setCreator("Sellqo");
    pdfDoc.setCreationDate(new Date());
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const text = rgb(0.12, 0.12, 0.12);
    const gray = rgb(0.45, 0.45, 0.45);
    const accent = rgb(0.86, 0.2, 0.27); // credit = red accent
    const lightGray = rgb(0.9, 0.9, 0.92);
    const margin = 50;
    let y = height - margin;

    // ---- Header ----
    const logoImg = await tryEmbedLogo(pdfDoc, admin, tenant);
    if (logoImg) {
      const dims = logoImg.scale(1);
      const maxW = 150, maxH = 50;
      const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
      const w = dims.width * scale, h = dims.height * scale;
      page.drawImage(logoImg, { x: margin, y: y - h + 14, width: w, height: h });
    } else {
      page.drawText(String(tenant.name || ""), { x: margin, y, size: 18, font: bold, color: text });
    }
    page.drawText(HEADER[lang], { x: width - margin - 240, y, size: 22, font: bold, color: accent });
    y -= 22;
    page.drawText(String(cn.credit_note_number), { x: width - margin - 240, y, size: 12, font: helv, color: gray });

    // ---- Two-column info blocks ----
    y -= 36;
    const colLeftX = margin;
    const colRightX = width / 2 + 10;
    const blockStartY = y;

    // Left: tenant address
    const tLines = [
      tenant.name,
      tenant.address,
      [tenant.postal_code, tenant.city].filter(Boolean).join(" "),
      tenant.country,
      tenant.vat_number || tenant.btw_number ? `BTW: ${tenant.vat_number || tenant.btw_number}` : null,
      tenant.iban ? `IBAN: ${tenant.iban}` : null,
      tenant.owner_email || tenant.email,
      tenant.phone ? `Tel: ${tenant.phone}` : null,
    ].filter(Boolean) as string[];
    let yL = blockStartY;
    for (const [i, l] of tLines.entries()) {
      page.drawText(l, { x: colLeftX, y: yL, size: 10, font: i === 0 ? bold : helv, color: i === 0 ? text : gray });
      yL -= 12;
    }

    // Right: recipient
    const c = cn.customer || {};
    const cName = customerDisplayName(c, lang);
    const billing = (c.default_billing_address || {}) as any;
    const cStreet = c.billing_street || billing.street || billing.address_line1 || null;
    const cPostal = c.billing_postal_code || billing.postal_code || null;
    const cCity = c.billing_city || billing.city || null;
    const cCountry = c.billing_country || billing.country || null;
    const cLines = [
      cName,
      cStreet,
      [cPostal, cCity].filter(Boolean).join(" ") || null,
      cCountry,
      c.vat_number ? `BTW: ${c.vat_number}` : null,
      c.email,
    ].filter(Boolean) as string[];
    page.drawText(T.recipient[lang], { x: colRightX, y: blockStartY + 14, size: 9, font: bold, color: gray });
    let yR = blockStartY;
    for (const [i, l] of cLines.entries()) {
      page.drawText(String(l), { x: colRightX, y: yR, size: 10, font: i === 0 ? bold : helv, color: text });
      yR -= 12;
    }
    y = Math.min(yL, yR) - 6;

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
    page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 20, color: rgb(0.953, 0.957, 0.965) });
    page.drawText(T.description[lang], { x: margin + 8, y, size: 10, font: bold, color: text });
    page.drawText(T.qty[lang], { x: 320, y, size: 10, font: bold, color: text });
    page.drawText(T.vat[lang], { x: 370, y, size: 10, font: bold, color: text });
    page.drawText(T.unit[lang], { x: 420, y, size: 10, font: bold, color: text });
    page.drawText(T.lineTotal[lang], { x: 490, y, size: 10, font: bold, color: text });
    y -= 18;

    const lines = (cn.lines || []) as any[];
    const vatGroups = new Map<number, { taxable: number; vat: number }>();
    for (const ln of lines) {
      const desc = String(ln.description || "").substring(0, 42);
      const qty = Number(ln.quantity || 1);
      const rate = Number(ln.vat_rate || 0);
      const unit = Math.abs(Number(ln.unit_price || 0));
      const total = Math.abs(Number(ln.line_total || 0));
      const vat = Math.abs(Number(ln.vat_amount || 0));
      const grp = vatGroups.get(rate) || { taxable: 0, vat: 0 };
      grp.taxable += total; grp.vat += vat;
      vatGroups.set(rate, grp);
      page.drawText(desc, { x: margin + 8, y, size: 10, font: helv, color: text });
      page.drawText(String(qty), { x: 320, y, size: 10, font: helv, color: text });
      page.drawText(`${rate}%`, { x: 370, y, size: 10, font: helv, color: text });
      page.drawText(fmt(unit, currency), { x: 420, y, size: 10, font: helv, color: text });
      page.drawText(fmt(total, currency), { x: 490, y, size: 10, font: helv, color: text });
      page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: width - margin, y: y - 4 }, thickness: 0.5, color: lightGray });
      y -= 14;
      if (y < 180) break;
    }

    // Totals
    y -= 10;
    const totalsX = 380;
    page.drawText(T.subtotal[lang], { x: totalsX, y, size: 10, font: helv, color: text });
    page.drawText(fmt(Math.abs(Number(cn.subtotal || 0)), currency), { x: 490, y, size: 10, font: helv, color: text });
    y -= 14;
    // VAT lines per rate
    for (const [rate, g] of vatGroups.entries()) {
      if (g.vat === 0) continue;
      page.drawText(`${T.vatLabel[lang]} ${rate}%`, { x: totalsX, y, size: 10, font: helv, color: text });
      page.drawText(fmt(g.vat, currency), { x: 490, y, size: 10, font: helv, color: text });
      y -= 14;
    }
    page.drawRectangle({ x: totalsX - 6, y: y - 6, width: width - margin - totalsX + 6, height: 22, color: rgb(0.97, 0.93, 0.94) });
    page.drawText(T.totalCredit[lang], { x: totalsX, y, size: 12, font: bold, color: accent });
    page.drawText(fmt(Math.abs(Number(cn.total || 0)), currency), { x: 490, y, size: 12, font: bold, color: accent });

    // VAT regime notice — reuse original invoice regime if present
    y -= 36;
    const regime = (inv as any)?.vat_regime as string | undefined;
    // Map regime aliases used in vat-regime engine to local keys
    const regimeKey = (r?: string): keyof typeof VAT_TEXTS | null => {
      if (!r) return null;
      if (r in VAT_TEXTS) return r as keyof typeof VAT_TEXTS;
      if (r === "ic_supply_goods") return "intracom_goods";
      if (r === "ic_supply_services") return "intracom_services";
      if (r === "oss_b2c_eu") return "oss_b2c_eu";
      if (r === "export_outside_eu") return "export_outside_eu";
      return null;
    };
    const rk = regimeKey(regime);
    if (rk && VAT_TEXTS[rk]?.[lang]) {
      const note = `${T.vatNotice[lang]}: ${VAT_TEXTS[rk][lang]}`;
      const wrapped = note.match(/.{1,95}(\s|$)/g) || [note];
      for (const w of wrapped) {
        page.drawText(w.trim(), { x: margin, y, size: 9, font: helv, color: gray });
        y -= 11;
      }
    }

    // Refund status
    y -= 10;
    if (inv?.payment_status === "refunded" || cn.status === "processed") {
      page.drawText(T.refundIssued[lang], { x: margin, y, size: 9, font: bold, color: gray });
    } else {
      page.drawText(T.refundPending[lang], { x: margin, y, size: 9, font: helv, color: gray });
    }

    // Footer
    const footerText: string | null = (tenant.invoice_footer_text as string) || null;
    if (footerText) {
      let fy = 70;
      page.drawLine({ start: { x: margin, y: fy + 12 }, end: { x: width - margin, y: fy + 12 }, thickness: 0.5, color: lightGray });
      const fLines = (footerText.match(/.{1,110}(\s|$)/g) || [footerText]).slice(0, 3);
      for (const fl of fLines) {
        page.drawText(fl.trim(), { x: margin, y: fy, size: 8, font: helv, color: gray });
        fy -= 10;
      }
    }
    if (cn.peppol_status === "accepted" || cn.peppol_status === "archive_only") {
      page.drawText("Verzonden via Peppol", { x: width - margin - 130, y: 40, size: 8, font: bold, color: gray });
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

    // ---- Generate Peppol UBL (best effort, never blocks) ----
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const ublRes = await fetch(`${url}/functions/v1/generate-peppol-ubl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sr}`,
          "apikey": sr,
        },
        body: JSON.stringify({ document_type: "credit_note", document_id: cn.id }),
      });
      const ublJson = await ublRes.json().catch(() => ({}));
      if (ublJson?.ubl_url) {
        await admin
          .from("credit_notes")
          .update({
            ubl_url: ublJson.ubl_url,
            peppol_status: ublJson.peppol_status || (cn.peppol_required ? "pending" : "archive_only"),
          })
          .eq("id", cn.id);
      } else {
        console.warn("[generate-credit-note] UBL generation returned no url", ublJson);
      }
    } catch (ublErr) {
      console.warn("[generate-credit-note] UBL generation failed", ublErr);
    }

    // Audit log
    if (auth.user_id !== "service_role") {
      await admin.from("admin_actions_log").insert({
        tenant_id: cn.tenant_id,
        user_id: auth.user_id,
        action_type: "credit_note_pdf_generated",
        action_details: { credit_note_id: cn.id, language: lang, credit_note_number: cn.credit_note_number },
      });
    }

    // Optional auto-send by email (best-effort, never fails the PDF call)
    let email_sent = false;
    if (auto_send_email) {
      try {
        const url = Deno.env.get("SUPABASE_URL")!;
        const authHeader = req.headers.get("Authorization") || `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`;
        const r = await fetch(`${url}/functions/v1/send-credit-note-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": authHeader, "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: JSON.stringify({ credit_note_id: cn.id, language: lang }),
        });
        const j = await r.json();
        email_sent = !!j?.success;
        if (!email_sent) console.warn("[generate-credit-note] auto-send returned non-success", j);
      } catch (e) {
        console.warn("[generate-credit-note] auto-send failed", e);
      }
    }

    return new Response(JSON.stringify({ success: true, pdf_url: pdfUrl, credit_note: updated, email_sent }), {
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
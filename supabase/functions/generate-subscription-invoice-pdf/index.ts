// INV-DOC-1: minimal PDF + UBL document generator for subscription invoices.
// Subscription invoices are created by generate-subscription-invoices without
// a linked order — so the order-centric generate-invoice function can't render
// them. This function fills that gap using pdf-lib and reuses the existing
// generate-peppol-ubl service for the UBL side.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(Number(n) || 0);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : JSON.stringify(e);
}

async function tryEmbedLogo(pdfDoc: any, tenant: any): Promise<any | null> {
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
    const { invoice_id } = body as { invoice_id?: string };
    if (!invoice_id) {
      return new Response(JSON.stringify({ success: false, error: "invoice_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .select("id, tenant_id, customer_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, ogm_reference, subscription_id, pdf_url")
      .eq("id", invoice_id)
      .single();
    if (invErr || !inv) throw new Error(`Invoice not found: ${invErr?.message}`);

    const { data: tenant, error: tErr } = await admin
      .from("tenants").select("*").eq("id", inv.tenant_id).single();
    if (tErr || !tenant) throw new Error("Tenant not found");

    let customer: any = null;
    if (inv.customer_id) {
      const { data: c } = await admin.from("customers").select("*").eq("id", inv.customer_id).single();
      customer = c;
    }

    const { data: lines } = await admin
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("sort_order", { ascending: true });

    const currency = tenant.currency || "EUR";

    // ---- Render PDF ----
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`Invoice ${inv.invoice_number}`);
    pdfDoc.setAuthor(tenant.name || "");
    pdfDoc.setSubject(`Invoice ${inv.invoice_number}`);
    pdfDoc.setProducer("Sellqo Subscription Invoice Generator");
    pdfDoc.setCreator("Sellqo");
    pdfDoc.setCreationDate(new Date());
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const text = rgb(0.12, 0.12, 0.12);
    const gray = rgb(0.45, 0.45, 0.45);
    const accent = rgb(0.15, 0.4, 0.85);
    const lightGray = rgb(0.9, 0.9, 0.92);
    const margin = 50;
    let y = height - margin;

    const logoImg = await tryEmbedLogo(pdfDoc, tenant);
    if (logoImg) {
      const dims = logoImg.scale(1);
      const maxW = 150, maxH = 50;
      const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
      page.drawImage(logoImg, { x: margin, y: y - dims.height * scale + 14, width: dims.width * scale, height: dims.height * scale });
    } else {
      page.drawText(String(tenant.name || ""), { x: margin, y, size: 18, font: bold, color: text });
    }
    page.drawText("FACTUUR", { x: width - margin - 200, y, size: 22, font: bold, color: accent });
    y -= 22;
    page.drawText(String(inv.invoice_number), { x: width - margin - 200, y, size: 12, font: helv, color: gray });

    y -= 36;
    const colLeftX = margin;
    const colRightX = width / 2 + 10;
    const blockStartY = y;

    const tLines = [
      tenant.name,
      tenant.address,
      [tenant.postal_code, tenant.city].filter(Boolean).join(" "),
      tenant.country,
      tenant.vat_number || tenant.btw_number ? `BTW: ${tenant.vat_number || tenant.btw_number}` : null,
      tenant.iban ? `IBAN: ${tenant.iban}` : null,
      tenant.owner_email || tenant.email,
    ].filter(Boolean) as string[];
    let yL = blockStartY;
    for (const [i, l] of tLines.entries()) {
      page.drawText(String(l), { x: colLeftX, y: yL, size: 10, font: i === 0 ? bold : helv, color: i === 0 ? text : gray });
      yL -= 12;
    }

    const cName =
      (customer?.company_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim()) || "Klant";
    const cLines = [
      cName,
      customer?.billing_street,
      [customer?.billing_postal_code, customer?.billing_city].filter(Boolean).join(" ") || null,
      customer?.billing_country,
      customer?.vat_number ? `BTW: ${customer.vat_number}` : null,
      customer?.email,
    ].filter(Boolean) as string[];
    page.drawText("Geadresseerde", { x: colRightX, y: blockStartY + 14, size: 9, font: bold, color: gray });
    let yR = blockStartY;
    for (const [i, l] of cLines.entries()) {
      page.drawText(String(l), { x: colRightX, y: yR, size: 10, font: i === 0 ? bold : helv, color: text });
      yR -= 12;
    }
    y = Math.min(yL, yR) - 6;

    y -= 18;
    page.drawText("Factuurnummer:", { x: margin, y, size: 10, font: helv, color: gray });
    page.drawText(String(inv.invoice_number), { x: margin + 130, y, size: 10, font: bold, color: text });
    page.drawText("Datum:", { x: width / 2, y, size: 10, font: helv, color: gray });
    page.drawText(String(inv.issue_date || ""), { x: width / 2 + 100, y, size: 10, font: bold, color: text });
    y -= 14;
    if (inv.due_date) {
      page.drawText("Vervaldatum:", { x: margin, y, size: 10, font: helv, color: gray });
      page.drawText(String(inv.due_date), { x: margin + 130, y, size: 10, font: bold, color: text });
    }
    if (inv.ogm_reference) {
      page.drawText("OGM:", { x: width / 2, y, size: 10, font: helv, color: gray });
      page.drawText(String(inv.ogm_reference), { x: width / 2 + 100, y, size: 10, font: bold, color: text });
    }

    // Lines table
    y -= 26;
    page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 20, color: rgb(0.953, 0.957, 0.965) });
    page.drawText("Omschrijving", { x: margin + 8, y, size: 10, font: bold, color: text });
    page.drawText("Aantal", { x: 320, y, size: 10, font: bold, color: text });
    page.drawText("BTW%", { x: 370, y, size: 10, font: bold, color: text });
    page.drawText("Prijs", { x: 420, y, size: 10, font: bold, color: text });
    page.drawText("Totaal", { x: 490, y, size: 10, font: bold, color: text });
    y -= 18;

    for (const ln of (lines ?? [])) {
      const desc = String((ln as any).description || "").substring(0, 42);
      page.drawText(desc, { x: margin + 8, y, size: 10, font: helv, color: text });
      page.drawText(String((ln as any).quantity || 1), { x: 320, y, size: 10, font: helv, color: text });
      page.drawText(`${Number((ln as any).vat_rate || 0)}%`, { x: 370, y, size: 10, font: helv, color: text });
      page.drawText(fmt(Number((ln as any).unit_price || 0), currency), { x: 420, y, size: 10, font: helv, color: text });
      page.drawText(fmt(Number((ln as any).line_total || 0), currency), { x: 490, y, size: 10, font: helv, color: text });
      page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: width - margin, y: y - 4 }, thickness: 0.5, color: lightGray });
      y -= 14;
      if (y < 180) break;
    }

    // Totals
    y -= 10;
    const totalsX = 380;
    page.drawText("Subtotaal", { x: totalsX, y, size: 10, font: helv, color: text });
    page.drawText(fmt(Number(inv.subtotal || 0), currency), { x: 490, y, size: 10, font: helv, color: text });
    y -= 14;
    page.drawText("BTW", { x: totalsX, y, size: 10, font: helv, color: text });
    page.drawText(fmt(Number(inv.tax_amount || 0), currency), { x: 490, y, size: 10, font: helv, color: text });
    y -= 18;
    page.drawRectangle({ x: totalsX - 6, y: y - 6, width: width - margin - totalsX + 6, height: 22, color: rgb(0.93, 0.95, 0.98) });
    page.drawText("Totaal", { x: totalsX, y, size: 12, font: bold, color: accent });
    page.drawText(fmt(Number(inv.total || 0), currency), { x: 490, y, size: 12, font: bold, color: accent });

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

    const pdfBytes = await pdfDoc.save();
    const safeNumber = String(inv.invoice_number).replace(/[^a-zA-Z0-9-]/g, "_");
    const pdfPath = `${inv.tenant_id}/${safeNumber}.pdf`;

    const { error: upErr } = await admin.storage
      .from("invoices")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`PDF upload failed: ${upErr.message}`);

    const { data: { publicUrl } } = admin.storage.from("invoices").getPublicUrl(pdfPath);

    await admin.from("invoices").update({ pdf_url: publicUrl, pdf_path: pdfPath }).eq("id", inv.id);

    // ---- UBL via existing service (best-effort) ----
    let ublUrl: string | null = null;
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${url}/functions/v1/generate-peppol-ubl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sr}`, "apikey": sr },
        body: JSON.stringify({ document_type: "invoice", document_id: inv.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ubl_url) ublUrl = j.ubl_url;
    } catch (ublErr) {
      console.warn("[generate-subscription-invoice-pdf] UBL generation failed", errMsg(ublErr));
    }

    return new Response(JSON.stringify({ success: true, pdf_url: publicUrl, ubl_url: ublUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = errMsg(error);
    console.error("[generate-subscription-invoice-pdf] error", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
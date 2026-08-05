// CYCLE-2: PDF generator for pay-first payment requests (billing_cycles).
// Explicitly NOT an invoice — the document carries a mandatory notice that
// the invoice follows after payment. Same template/storage pattern as
// generate-subscription-invoice-pdf; stored in the `invoices` bucket under
// <tenant_id>/payment-requests/<PR-number>.pdf. Only the PATH is written to
// the database (billing_cycles.pdf_path) — never a signed URL.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTICE = "Dit is geen factuur. Uw factuur volgt direct na ontvangst van de betaling.";

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
    const { billing_cycle_id } = body as { billing_cycle_id?: string };
    if (!billing_cycle_id) {
      return new Response(JSON.stringify({ success: false, error: "billing_cycle_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: cycle, error: cErr } = await admin
      .from("billing_cycles")
      .select("id, tenant_id, customer_id, subscription_id, period_start, period_end, subtotal, vat_amount, total, due_date, payment_request_number, checkout_session_url, description")
      .eq("id", billing_cycle_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cycle) throw new Error("Billing cycle not found");
    if (!cycle.payment_request_number) throw new Error("Cycle has no payment_request_number yet");

    const { data: tenant, error: tErr } = await admin
      .from("tenants").select("*").eq("id", cycle.tenant_id).maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) throw new Error("Tenant not found");

    let customer: any = null;
    if (cycle.customer_id) {
      const { data: c } = await admin.from("customers").select("*").eq("id", cycle.customer_id).maybeSingle();
      customer = c;
    }

    let subscriptionName = "Abonnement";
    if (cycle.subscription_id) {
      const { data: sub } = await admin
        .from("subscriptions").select("name").eq("id", cycle.subscription_id).maybeSingle();
      if (sub?.name) subscriptionName = String(sub.name);
    }

    const currency = tenant.currency || "EUR";
    const prNumber = String(cycle.payment_request_number);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`Betalingsverzoek ${prNumber}`);
    pdfDoc.setAuthor(tenant.name || "");
    pdfDoc.setSubject(`Betalingsverzoek ${prNumber}`);
    pdfDoc.setProducer("Sellqo Payment Request Generator");
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
    page.drawText("BETALINGSVERZOEK", { x: width - margin - 230, y, size: 18, font: bold, color: accent });
    y -= 20;
    page.drawText(prNumber, { x: width - margin - 230, y, size: 12, font: helv, color: gray });

    // Mandatory notice — prominent, directly under the header.
    y -= 30;
    page.drawRectangle({ x: margin, y: y - 8, width: width - 2 * margin, height: 26, color: rgb(0.98, 0.95, 0.86) });
    page.drawText(NOTICE, { x: margin + 8, y, size: 10, font: bold, color: rgb(0.4, 0.3, 0.05) });

    y -= 40;
    const colLeftX = margin;
    const colRightX = width / 2 + 10;
    const blockStartY = y;

    const tLines = [
      tenant.name,
      tenant.address,
      [tenant.postal_code, tenant.city].filter(Boolean).join(" "),
      tenant.country,
      (tenant.vat_number || tenant.btw_number) ? `BTW: ${tenant.vat_number || tenant.btw_number}` : null,
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
    page.drawText("Verzoeknummer:", { x: margin, y, size: 10, font: helv, color: gray });
    page.drawText(prNumber, { x: margin + 130, y, size: 10, font: bold, color: text });
    page.drawText("Periode:", { x: width / 2, y, size: 10, font: helv, color: gray });
    page.drawText(`${cycle.period_start} t/m ${cycle.period_end}`, { x: width / 2 + 100, y, size: 10, font: bold, color: text });
    y -= 14;
    if (cycle.due_date) {
      page.drawText("Gewenste betaaldatum:", { x: margin, y, size: 10, font: helv, color: gray });
      page.drawText(String(cycle.due_date), { x: margin + 130, y, size: 10, font: bold, color: text });
    }

    // Single summary line — the cycle carries totals, not line detail.
    y -= 26;
    page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 20, color: rgb(0.953, 0.957, 0.965) });
    page.drawText("Omschrijving", { x: margin + 8, y, size: 10, font: bold, color: text });
    page.drawText("Bedrag", { x: 480, y, size: 10, font: bold, color: text });
    y -= 18;
    // UPGRADE-PF-1: a proration cycle carries its own description
    // ("Upgrade X → Y (pro rata n/m d, ...)"). Wrap instead of truncating.
    const rawDesc = cycle.description
      ? String(cycle.description)
      : `${subscriptionName} (${cycle.period_start} t/m ${cycle.period_end})`;
    const descLines: string[] = [];
    for (const word of rawDesc.split(" ")) {
      const last = descLines[descLines.length - 1];
      if (last && (last + " " + word).length <= 62) descLines[descLines.length - 1] = `${last} ${word}`;
      else descLines.push(word);
      if (descLines.length >= 3) break;
    }
    page.drawText(fmt(Number(cycle.subtotal), currency), { x: 480, y, size: 10, font: helv, color: text });
    for (const [i, dl] of descLines.entries()) {
      page.drawText(dl, { x: margin + 8, y: y - i * 12, size: 10, font: helv, color: text });
    }
    y -= (descLines.length - 1) * 12;
    page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: width - margin, y: y - 4 }, thickness: 0.5, color: lightGray });

    y -= 26;
    const totalsX = 380;
    page.drawText("Subtotaal", { x: totalsX, y, size: 10, font: helv, color: text });
    page.drawText(fmt(Number(cycle.subtotal), currency), { x: 480, y, size: 10, font: helv, color: text });
    y -= 14;
    page.drawText("BTW", { x: totalsX, y, size: 10, font: helv, color: text });
    page.drawText(fmt(Number(cycle.vat_amount), currency), { x: 480, y, size: 10, font: helv, color: text });
    y -= 18;
    page.drawRectangle({ x: totalsX - 6, y: y - 6, width: width - margin - totalsX + 6, height: 22, color: rgb(0.93, 0.95, 0.98) });
    page.drawText("Te betalen", { x: totalsX, y, size: 12, font: bold, color: accent });
    page.drawText(fmt(Number(cycle.total), currency), { x: 480, y, size: 12, font: bold, color: accent });

    if (cycle.checkout_session_url) {
      y -= 40;
      page.drawText("Online betalen:", { x: margin, y, size: 10, font: bold, color: text });
      y -= 12;
      const link = String(cycle.checkout_session_url);
      page.drawText(link.substring(0, 95), { x: margin, y, size: 8, font: helv, color: accent });
    }

    // Footer repeats the notice so it can never be mistaken for an invoice.
    page.drawLine({ start: { x: margin, y: 82 }, end: { x: width - margin, y: 82 }, thickness: 0.5, color: lightGray });
    page.drawText(NOTICE, { x: margin, y: 70, size: 8, font: bold, color: gray });

    const pdfBytes = await pdfDoc.save();
    const safeNumber = prNumber.replace(/[^a-zA-Z0-9-]/g, "_");
    const pdfPath = `${cycle.tenant_id}/payment-requests/${safeNumber}.pdf`;

    const { error: upErr } = await admin.storage
      .from("invoices")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`PDF upload failed: ${upErr.message}`);

    const { error: updErr } = await admin
      .from("billing_cycles")
      .update({ pdf_path: pdfPath })
      .eq("id", cycle.id)
      .select("id");
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, pdf_path: pdfPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = errMsg(error);
    console.error("[generate-payment-request-pdf] error", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
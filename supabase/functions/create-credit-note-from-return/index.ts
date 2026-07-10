// CN-AUTO-1: automatically create a credit note when a return is approved
// (or, in a future path, when a standalone order refund is completed).
//
// Idempotency: enforced by the `credit_notes.return_id` unique index. Callers
// may retry safely — a second invocation returns the existing credit note.
//
// Called service-to-service (from useReturns after status→approved, and as a
// safety net from process-refund on refund_status=completed).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : JSON.stringify(e);
}

// OGM (Belgian structured payment reference) — 12 digits, checksum by mod 97.
function generateOGM(source: string): string {
  const digits = source.replace(/\D/g, "").padStart(10, "0").slice(-10);
  const mod = BigInt(digits) % 97n;
  const check = mod.toString().padStart(2, "0");
  const raw = digits + check;
  return `+++${raw.slice(0, 3)}/${raw.slice(3, 7)}/${raw.slice(7, 12)}+++`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { return_id, auto_send_email = true } = body as {
      return_id?: string;
      auto_send_email?: boolean;
    };
    if (!return_id) {
      return new Response(JSON.stringify({ success: false, error: "return_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: existing CN for this return?
    const { data: existing } = await admin
      .from("credit_notes")
      .select("id, credit_note_number, pdf_url")
      .eq("return_id", return_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, credit_note_id: existing.id, already_exists: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ret, error: retErr } = await admin
      .from("returns")
      .select("id, tenant_id, order_id, customer_id, refund_amount, return_reason, rma_number, stripe_refund_id")
      .eq("id", return_id)
      .single();
    if (retErr || !ret) throw new Error(`Return not found: ${retErr?.message}`);

    if (!ret.order_id) {
      return new Response(JSON.stringify({ success: false, error: "return has no order — skipping", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the invoice linked to this order. If none, skip per spec.
    const { data: invoice } = await admin
      .from("invoices")
      .select("id, invoice_number, customer_id, total, tenant_id")
      .eq("order_id", ret.order_id)
      .maybeSingle();
    if (!invoice) {
      return new Response(JSON.stringify({ success: false, error: "no invoice for order — skipping", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather return items (drives the CN line breakdown). We include
    // `received_quantity` and `inspected_at` so the CN reflects the ACCEPTED
    // items/quantities from inspection, not the originally requested ones.
    const { data: items } = await admin
      .from("return_items")
      .select("product_name, quantity, received_quantity, inspected_at, unit_price, line_total, refund_amount")
      .eq("return_id", return_id);

    // Determine credit-note lines. Use return_items when present; otherwise
    // fall back to a single "goodwill" line at refund_amount.
    type Line = {
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      vat_rate: number;
      vat_amount: number;
      line_type: "product" | "shipping" | "discount";
    };

    const lines: Line[] = [];

    // Approximate VAT rate from the original invoice: total vs subtotal.
    const { data: fullInv } = await admin
      .from("invoices")
      .select("subtotal, total, tax_amount")
      .eq("id", invoice.id)
      .single();
    const invSubtotal = Number(fullInv?.subtotal ?? 0);
    const invTax = Number(fullInv?.tax_amount ?? 0);
    const approxVatRate = invSubtotal > 0 ? Math.round((invTax / invSubtotal) * 100) : 0;

    if (items && items.length > 0) {
      for (const it of items as any[]) {
        const requestedQty = Number(it.quantity || 0);
        // After inspection, received_quantity is the accepted amount. Fall
        // back to the requested quantity when the column is not yet populated
        // (e.g. safety-net trigger from process-refund without inspection).
        const acceptedQty =
          it.received_quantity != null ? Number(it.received_quantity) : requestedQty;
        if (acceptedQty <= 0) continue; // rejected line — no credit

        const requestedGross = Number(it.refund_amount ?? it.line_total ?? 0);
        // Pro-rate the requested gross by accepted/requested ratio so
        // per-unit adjustments (restocking, discounts) are preserved.
        const gross =
          requestedQty > 0
            ? +((requestedGross * acceptedQty) / requestedQty).toFixed(2)
            : +requestedGross.toFixed(2);
        const net = approxVatRate > 0 ? gross / (1 + approxVatRate / 100) : gross;
        const vatAmount = +(gross - net).toFixed(2);
        lines.push({
          description: String(it.product_name || "Retour"),
          quantity: acceptedQty,
          unit_price: +(net / Math.max(1, acceptedQty)).toFixed(2),
          line_total: +net.toFixed(2),
          vat_rate: approxVatRate,
          vat_amount: vatAmount,
          line_type: "product",
        });
      }
      if (lines.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "no accepted items after inspection — skipping", skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const gross = Number(ret.refund_amount ?? 0);
      if (gross <= 0) {
        return new Response(JSON.stringify({ success: false, error: "no refund amount — skipping", skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const net = approxVatRate > 0 ? gross / (1 + approxVatRate / 100) : gross;
      const vatAmount = +(gross - net).toFixed(2);
      lines.push({
        description: `Retour ${ret.rma_number || ""}`.trim(),
        quantity: 1,
        unit_price: +net.toFixed(2),
        line_total: +net.toFixed(2),
        vat_rate: approxVatRate,
        vat_amount: vatAmount,
        line_type: "product",
      });
    }

    const subtotal = +lines.reduce((s, l) => s + l.line_total, 0).toFixed(2);
    const taxAmount = +lines.reduce((s, l) => s + l.vat_amount, 0).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);

    // Full vs partial (compared to original invoice total).
    const cnType = Math.abs(total - Number(invoice.total || 0)) < 0.01 ? "full" : "partial";

    const { data: cnNumberData, error: numErr } = await admin.rpc("generate_credit_note_number", { _tenant_id: ret.tenant_id });
    if (numErr) throw new Error(`Number generation failed: ${numErr.message}`);
    const creditNoteNumber = cnNumberData as string;

    const ogmReference = generateOGM(creditNoteNumber);

    const { data: cn, error: cnErr } = await admin
      .from("credit_notes")
      .insert({
        tenant_id: ret.tenant_id,
        credit_note_number: creditNoteNumber,
        original_invoice_id: invoice.id,
        customer_id: invoice.customer_id || ret.customer_id || null,
        type: cnType,
        reason: ret.return_reason || `Retour ${ret.rma_number || ""}`.trim() || "Retour geïnspecteerd",
        subtotal,
        tax_amount: taxAmount,
        total,
        ogm_reference: ogmReference,
        status: "draft",
        return_id: ret.id,
        stripe_refund_id: ret.stripe_refund_id || null,
        auto_generated: true,
      })
      .select()
      .single();
    if (cnErr) {
      // Race: another concurrent invocation may have inserted first. Return
      // the existing row instead of failing.
      const { data: raced } = await admin
        .from("credit_notes").select("id").eq("return_id", return_id).maybeSingle();
      if (raced) {
        return new Response(JSON.stringify({ success: true, credit_note_id: raced.id, already_exists: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Credit note insert failed: ${cnErr.message}`);
    }

    const linesToInsert = lines.map((l) => ({ ...l, credit_note_id: cn.id }));
    const { error: linesErr } = await admin.from("credit_note_lines").insert(linesToInsert);
    if (linesErr) console.warn("[create-credit-note-from-return] line insert warning", linesErr.message);

    // Link the return back to the credit note.
    await admin.from("returns").update({ credit_note_id: cn.id }).eq("id", ret.id);

    // Generate PDF/UBL + optionally send email.
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(`${url}/functions/v1/generate-credit-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sr}`, "apikey": sr },
        body: JSON.stringify({ credit_note_id: cn.id, auto_send_email }),
      });
    } catch (docErr) {
      console.warn("[create-credit-note-from-return] doc generation failed", errMsg(docErr));
    }

    return new Response(JSON.stringify({ success: true, credit_note_id: cn.id, credit_note_number: creditNoteNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = errMsg(error);
    console.error("[create-credit-note-from-return] error", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
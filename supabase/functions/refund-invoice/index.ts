// INVOICE-REFUND-1 — volledige Stripe-terugbetaling + creditnota voor een
// betaalde factuur (ook abonnements- en handmatige facturen zonder order).
//
// De payment intent staat NIET op de factuur: hij leeft in Stripe met
// metadata.invoice_id (gezet door de abonnementsflow). We zoeken hem daar op.
//
// Auth: eigen-tenant guard zoals manage-odoo-connection (tenant_admin) of
// platform_admin (bypass in requireRole).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** Belgische gestructureerde mededeling (kopie van src/lib/ogm.ts). */
function generateOGM(baseNumber: string): string {
  let numericBase = baseNumber.replace(/\D/g, "");
  if (!numericBase || numericBase === "0") numericBase = Date.now().toString().slice(-10);
  numericBase = numericBase.slice(-10).padStart(10, "0");
  const remainder = Number(BigInt(numericBase) % 97n);
  const checksum = (remainder === 0 ? 97 : remainder).toString().padStart(2, "0");
  const full = numericBase + checksum;
  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7, 12)}+++`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const invoiceId = (body as { invoice_id?: string }).invoice_id;
    if (!invoiceId) return json({ success: false, error: "invoice_id is verplicht" }, 400);

    // ── a) factuur laden + validatie ──
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, tenant_id, invoice_number, customer_id, status, total, metadata")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr) throw new Error(`Factuur laden mislukt: ${errMsg(invErr)}`);
    if (!invoice) return json({ success: false, error: "Factuur niet gevonden" }, 404);

    // OWN-TENANT GUARD (hard): 403 voor niet-platform-admins buiten de tenant.
    const auth = await authenticateRequest(req, invoice.tenant_id as string);
    requireRole(auth, invoice.tenant_id as string, ["tenant_admin"]);

    if (invoice.status !== "paid") {
      return json({ success: false, error: "Alleen betaalde facturen kunnen worden terugbetaald" }, 400);
    }

    const metadata = (invoice.metadata ?? {}) as Record<string, unknown>;
    if (metadata.stripe_refund_id) {
      return json({ success: false, error: "Deze factuur is al terugbetaald" }, 409);
    }

    const { data: existingCns, error: cnErr } = await supabase
      .from("credit_notes")
      .select("id, status")
      .eq("original_invoice_id", invoiceId);
    if (cnErr) throw new Error(`Creditnota-check mislukt: ${errMsg(cnErr)}`);
    if ((existingCns ?? []).some((c) => c.status !== "cancelled")) {
      return json({ success: false, error: "Er bestaat al een creditnota voor deze factuur" }, 409);
    }

    // ── b) Stripe key resolven (zoals process-refund) ──
    const { data: tenantSettings } = await supabase
      .from("tenant_settings")
      .select("stripe_secret_key")
      .eq("tenant_id", invoice.tenant_id)
      .maybeSingle();

    const stripeKey = (tenantSettings?.stripe_secret_key as string | null) || Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ success: false, error: "Geen Stripe key geconfigureerd" }, 400);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", invoice.tenant_id)
      .maybeSingle();

    const stripeAccountId = tenant?.stripe_account_id as string | null;
    const requestOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" } as any);

    // ── c) payment intent zoeken via metadata ──
    let paymentIntentId: string | null = null;
    try {
      const search = await stripe.paymentIntents.search(
        { query: `metadata['invoice_id']:'${invoiceId}'` },
        requestOptions,
      );
      paymentIntentId = search.data.find((pi) => pi.status === "succeeded")?.id ?? null;
    } catch (e) {
      return json({ success: false, error: `Stripe-zoekopdracht mislukt: ${errMsg(e)}` }, 502);
    }

    if (!paymentIntentId) {
      return json({ success: false, error: "Geen Stripe-betaling gevonden voor deze factuur" }, 404);
    }

    // ── d) refund (volledig bedrag) ──
    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, reason: "requested_by_customer" },
        requestOptions,
      );
    } catch (e) {
      return json({ success: false, error: errMsg(e) }, 502);
    }

    // ── e) pas NA succes muteren: metadata + creditnota ──
    const refundedAt = new Date().toISOString();
    const { error: metaErr } = await supabase
      .from("invoices")
      .update({
        metadata: {
          ...metadata,
          stripe_refund_id: refund.id,
          stripe_payment_intent_id: paymentIntentId,
          refunded_at: refundedAt,
        },
      })
      .eq("id", invoiceId)
      .select("id");
    if (metaErr) console.error("[refund-invoice] metadata update failed", metaErr);

    // Creditnota voor ALLE factuurregels.
    const { data: lines, error: linesErr } = await supabase
      .from("invoice_lines")
      .select("id, description, quantity, unit_price, vat_rate, vat_amount, line_total, line_type")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });
    if (linesErr) throw new Error(`Factuurregels laden mislukt: ${errMsg(linesErr)}`);

    const cnLines = (lines ?? []).map((l) => ({
      original_invoice_line_id: l.id as string,
      description: (l.description as string) || "",
      quantity: Number(l.quantity ?? 1),
      unit_price: Number(l.unit_price ?? 0),
      vat_rate: Number(l.vat_rate ?? 0),
      vat_amount: Number(l.vat_amount ?? 0),
      line_total: Number(l.line_total ?? 0),
      line_type: (l.line_type as string) || "product",
    }));

    const { data: cnNumber, error: numErr } = await supabase
      .rpc("generate_credit_note_number", { _tenant_id: invoice.tenant_id });
    if (numErr) throw new Error(`Creditnotanummer mislukt: ${errMsg(numErr)}`);

    const subtotal = cnLines.reduce((s, l) => s + l.line_total, 0);
    const taxAmount = cnLines.reduce((s, l) => s + l.vat_amount, 0);

    const { data: creditNote, error: cnInsertErr } = await supabase
      .from("credit_notes")
      .insert({
        tenant_id: invoice.tenant_id,
        credit_note_number: cnNumber as string,
        original_invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        type: "full",
        reason: "Terugbetaling",
        subtotal,
        tax_amount: taxAmount,
        total: subtotal + taxAmount,
        ogm_reference: generateOGM(cnNumber as string),
        status: "draft",
      })
      .select()
      .single();
    if (cnInsertErr) throw new Error(`Creditnota aanmaken mislukt: ${errMsg(cnInsertErr)}`);

    if (cnLines.length > 0) {
      const { error: cnLinesErr } = await supabase
        .from("credit_note_lines")
        .insert(cnLines.map((l) => ({ ...l, credit_note_id: creditNote.id })));
      if (cnLinesErr) throw new Error(`Creditnotaregels mislukt: ${errMsg(cnLinesErr)}`);
    }

    // Hergebruik de bestaande PDF/UBL/mail-pijplijn.
    let pdfGenerated = false;
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${url}/functions/v1/generate-credit-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sr}`, apikey: sr },
        body: JSON.stringify({ credit_note_id: creditNote.id, auto_send_email: true }),
      });
      pdfGenerated = res.ok;
      if (!res.ok) console.error("[refund-invoice] generate-credit-note failed", await res.text());
    } catch (e) {
      console.error("[refund-invoice] generate-credit-note error", errMsg(e));
    }

    return json({
      success: true,
      stripe_refund_id: refund.id,
      credit_note_id: creditNote.id,
      credit_note_number: cnNumber,
      pdf_generated: pdfGenerated,
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, corsHeaders);
    console.error("[refund-invoice] error", errMsg(e));
    return json({ success: false, error: errMsg(e) }, 500);
  }
});
/**
 * Fase 4.2 — Peppol BIS Billing 3.0 UBL generator (archive-mode MVP).
 *
 * Input:  { invoice_id: string }
 * Output: { success, skipped?, reason?, ubl_url?, storage_key?, peppol_status, sha256 }
 *
 * Behavior:
 * - Resolves invoice + tenant + customer (with cascade to orders for B2C-marketplace).
 * - B2B-detection: only generates UBL when both vat_regime is Peppol-relevant
 *   AND a customer VAT number is available (customers or orders.customer_vat_number).
 * - Otherwise → marks invoice peppol_status='not_applicable' and returns skipped.
 * - On success: stores XML in storage bucket "peppol-archive" at
 *   {tenant_id}/{invoice_id}.xml, creates invoice_archive row, signs URL for 7 days
 *   and writes ubl_url + peppol_status='archive_only' + ubl_generated_at on the invoice.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCorsOptions, getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";
import {
  buildPeppolUbl,
  type UblInvoiceInput,
  type UblLine,
  type UblParty,
} from "../_shared/peppol/ubl-builder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PEPPOL_RELEVANT_REGIMES = new Set([
  "domestic_standard",
  "domestic_reduced_6",
  "domestic_reduced_12",
  "ic_supply_goods",
  "ic_supply_services",
  "ic_triangulation",
  "ic_supply_triangulation",
  "reverse_charge_construction",
]);

const BUCKET = "peppol-archive";
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ymd(d: string | Date | null): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  let body: { invoice_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const invoiceId = (body.invoice_id ?? "").trim();
  if (!invoiceId) {
    return new Response(JSON.stringify({ success: false, error: "invoice_id required" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Load invoice first to know its tenant_id for auth.
  const { data: invoice, error: invErr } = await sb
    .from("invoices")
    .select("id, tenant_id, customer_id, order_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, status, vat_regime, peppol_status, vat_number_validated_value")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !invoice) {
    return new Response(JSON.stringify({ success: false, error: "invoice not found" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Auth: admin / member of the invoice's tenant.
  try {
    await authenticateRequest(req, invoice.tenant_id);
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    throw e;
  }

  // Try to fetch OGM / payment reference from the linked order (invoices table
  // has no payment_reference column in current schema).
  let paymentReference: string | null = null;
  if (invoice.order_id) {
    const { data: ord } = await sb.from("orders")
      .select("ogm_reference, external_reference")
      .eq("id", invoice.order_id).maybeSingle();
    paymentReference = ord?.ogm_reference ?? ord?.external_reference ?? null;
  }

  // Resolve detect/early-skip non-Peppol regimes.
  const regime = String(invoice.vat_regime ?? "");
  if (!PEPPOL_RELEVANT_REGIMES.has(regime)) {
    await sb.from("invoices").update({ peppol_status: "not_applicable" }).eq("id", invoiceId);
    return new Response(JSON.stringify({
      success: true, skipped: true, reason: `regime "${regime}" is not Peppol-relevant`,
      peppol_status: "not_applicable",
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Tenant (supplier).
  const { data: tenant, error: tErr } = await sb
    .from("tenants")
    .select("id, name, btw_number, kvk_number, peppol_id, iban, address, postal_code, city, country, owner_email, phone")
    .eq("id", invoice.tenant_id)
    .maybeSingle();
  if (tErr || !tenant) {
    return new Response(JSON.stringify({ success: false, error: "tenant not found" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Customer cascade.
  let custVat: string | null = null;
  let custName: string | null = null;
  let custCountry: string | null = null;
  let custStreet: string | null = null;
  let custCity: string | null = null;
  let custPostal: string | null = null;
  let custEmail: string | null = null;
  let custPhone: string | null = null;
  let custRegistration: string | null = null;

  if (invoice.customer_id) {
    const { data: c } = await sb.from("customers")
      .select("vat_number, company_name, first_name, last_name, billing_country, billing_city, billing_postal_code, default_billing_address, email, phone")
      .eq("id", invoice.customer_id).maybeSingle();
    if (c) {
      custVat = c.vat_number ?? null;
      custName = c.company_name?.trim() || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null;
      custCountry = c.billing_country ?? null;
      custCity = c.billing_city ?? null;
      custPostal = c.billing_postal_code ?? null;
      custEmail = c.email ?? null;
      custPhone = c.phone ?? null;
      const addr = c.default_billing_address as Record<string, unknown> | null;
      if (addr && typeof addr === "object") {
        custStreet = (addr.street as string) ?? (addr.address_line1 as string) ?? null;
        custCity = custCity ?? (addr.city as string) ?? null;
        custPostal = custPostal ?? (addr.postal_code as string) ?? null;
        custCountry = custCountry ?? (addr.country as string) ?? null;
      }
    }
  }

  // Fallback to order denormalized fields.
  if (invoice.order_id) {
    const { data: o } = await sb.from("orders")
      .select("customer_vat_number, customer_company_name, customer_name, customer_email, customer_phone, shipping_address, billing_address")
      .eq("id", invoice.order_id).maybeSingle();
    if (o) {
      custVat = custVat ?? o.customer_vat_number ?? null;
      custName = custName ?? (o.customer_company_name?.trim() || o.customer_name?.trim() || null);
      custEmail = custEmail ?? o.customer_email ?? null;
      custPhone = custPhone ?? o.customer_phone ?? null;
      const addr = (o.billing_address ?? o.shipping_address) as Record<string, unknown> | null;
      if (addr && typeof addr === "object") {
        custStreet = custStreet ?? (addr.street as string) ?? (addr.address_line1 as string) ?? null;
        custCity = custCity ?? (addr.city as string) ?? null;
        custPostal = custPostal ?? (addr.postal_code as string) ?? null;
        custCountry = custCountry ?? (addr.country as string) ?? null;
      }
    }
  }

  // B2B check.
  if (!custVat || !custVat.trim()) {
    await sb.from("invoices").update({ peppol_status: "not_applicable" }).eq("id", invoiceId);
    return new Response(JSON.stringify({
      success: true, skipped: true, reason: "b2c_no_vat",
      peppol_status: "not_applicable",
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Invoice lines.
  const { data: rawLines, error: linesErr } = await sb.from("invoice_lines")
    .select("description, quantity, unit_price, vat_rate, line_total, sort_order, line_type")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });
  if (linesErr || !rawLines || rawLines.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "invoice has no lines" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const lines: UblLine[] = rawLines.map((l, i) => ({
    id: i + 1,
    description: String(l.description ?? "Item"),
    quantity: Number(l.quantity ?? 1),
    unitCode: "C62",
    unitPrice: Number(l.unit_price ?? 0),
    lineTotal: Number(l.line_total ?? 0),
    vatRate: Number(l.vat_rate ?? 0),
  }));

  const supplier: UblParty = {
    name: tenant.name,
    country: (tenant.country ?? "BE").toUpperCase(),
    vatNumber: tenant.btw_number ?? null,
    registrationNumber: tenant.kvk_number ?? null,
    street: tenant.address ?? null,
    city: tenant.city ?? null,
    postalCode: tenant.postal_code ?? null,
    contactEmail: tenant.owner_email ?? null,
    contactPhone: tenant.phone ?? null,
  };

  const customer: UblParty = {
    name: custName ?? "Customer",
    country: (custCountry ?? "").toUpperCase(),
    vatNumber: custVat,
    registrationNumber: custRegistration,
    street: custStreet,
    city: custCity,
    postalCode: custPostal,
    contactEmail: custEmail,
    contactPhone: custPhone,
  };

  // Determine if this is a credit note (negative total or invoice_number with "CN-" prefix).
  const isCreditNote = Number(invoice.total ?? 0) < 0
    || /^CN-/i.test(String(invoice.invoice_number ?? ""))
    || /^CR-/i.test(String(invoice.invoice_number ?? ""));

  const ublInput: UblInvoiceInput = {
    documentType: isCreditNote ? "credit_note" : "invoice",
    documentNumber: invoice.invoice_number,
    issueDate: ymd(invoice.issue_date) ?? new Date().toISOString().slice(0, 10),
    dueDate: ymd(invoice.due_date),
    currency: "EUR",
    buyerReference: paymentReference,
    paymentReference: paymentReference,
    supplier,
    customer,
    vatRegime: regime,
    lines,
    subtotal: Number(invoice.subtotal ?? 0),
    taxAmount: Number(invoice.tax_amount ?? 0),
    total: Number(invoice.total ?? 0),
    iban: tenant.iban ?? null,
  };

  let xml: string;
  try {
    xml = buildPeppolUbl(ublInput);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-peppol-ubl] builder error:", msg);
    await sb.from("invoices").update({
      peppol_status: "error",
      peppol_error: msg.slice(0, 500),
    }).eq("id", invoiceId);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const bytes = new TextEncoder().encode(xml);
  const sha256 = await sha256Hex(bytes);
  const storageKey = `${invoice.tenant_id}/${invoice.id}.xml`;

  // Upload to bucket (upsert to allow regeneration).
  const upload = await sb.storage.from(BUCKET).upload(storageKey, bytes, {
    contentType: "application/xml",
    upsert: true,
  });
  if (upload.error) {
    console.error("[generate-peppol-ubl] upload error:", upload.error);
    return new Response(JSON.stringify({ success: false, error: `storage upload failed: ${upload.error.message}` }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Signed URL — 7 days.
  const signed = await sb.storage.from(BUCKET).createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);
  const ublUrl = signed.data?.signedUrl ?? null;

  // Write invoice_archive row (best-effort; bucket already has truth).
  const archiveExpires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 10 years (legal min in BE = 7y)
  await sb.from("invoice_archive").upsert({
    tenant_id: invoice.tenant_id,
    document_id: invoice.id,
    document_type: isCreditNote ? "credit_note" : "invoice",
    document_number: invoice.invoice_number,
    pdf_storage_key: `placeholder/${invoice.id}.pdf`, // PDF archive lives separately; mandatory NOT NULL
    ubl_storage_key: storageKey,
    sha256_hash: sha256,
    file_size_bytes: bytes.byteLength,
    expires_at: archiveExpires,
    metadata: { source: "generate-peppol-ubl", mode: "archive_only", customization_id: "BIS3.0" },
  }, { onConflict: "document_id" });

  // Update invoice.
  await sb.from("invoices").update({
    ubl_url: ublUrl,
    peppol_status: "archive_only",
    ubl_generated_at: new Date().toISOString(),
    peppol_error: null,
  }).eq("id", invoiceId);

  return new Response(JSON.stringify({
    success: true,
    skipped: false,
    peppol_status: "archive_only",
    storage_key: storageKey,
    ubl_url: ublUrl,
    sha256,
    bytes: bytes.byteLength,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
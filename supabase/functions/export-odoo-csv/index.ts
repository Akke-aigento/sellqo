// export-odoo-csv — generates an Odoo l10n_be-ready CSV import bundle
// (invoices.csv + invoice_lines.csv) for a tenant's period.
// Admin-only (JWT verified). Returns a ZIP as binary download.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReqBody {
  tenant_id: string;
  period_start: string;
  period_end: string;
}

// vat_regime → { account, tax }
const REGIME_MAP: Record<string, { account: string; tax: string }> = {
  domestic_standard:           { account: "700000", tax: "l10n_be.1_attn_VAT-OUT-21-S" },
  domestic_reduced_6:          { account: "700100", tax: "l10n_be.1_attn_VAT-OUT-06-S" },
  domestic_reduced_12:         { account: "700200", tax: "l10n_be.1_attn_VAT-OUT-12-S" },
  domestic_zero:               { account: "700000", tax: "l10n_be.1_attn_VAT-OUT-00-S" },
  ic_supply_goods:             { account: "700300", tax: "l10n_be.1_attn_VAT-OUT-00-EU-G" },
  ic_supply_services:          { account: "706000", tax: "l10n_be.1_attn_VAT-OUT-00-EU-S" },
  ic_supply_triangulation:     { account: "700300", tax: "l10n_be.1_attn_VAT-OUT-00-EU-T" },
  ic_triangulation:            { account: "700300", tax: "l10n_be.1_attn_VAT-OUT-00-EU-T" },
  export_outside_eu:           { account: "700400", tax: "l10n_be.1_attn_VAT-OUT-00-EX" },
  oss_b2c_eu:                  { account: "700500", tax: "l10n_be.1_attn_VAT-OUT-OSS" },
  reverse_charge_construction: { account: "700600", tax: "l10n_be.1_attn_VAT-OUT-00-CO" },
  marketplace_deemed_supplier: { account: "700700", tax: "l10n_be.1_attn_VAT-OUT-00-MD" },
  exempt_article_44:           { account: "700800", tax: "l10n_be.1_attn_VAT-OUT-EX-44" },
};

function slugify(s: string): string {
  return (s || "tenant").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 60) || "tenant";
}

function periodCode(start: string, end: string): string {
  const ys = start.slice(0, 4);
  const ms = parseInt(start.slice(5, 7), 10);
  const me = parseInt(end.slice(5, 7), 10);
  const ye = end.slice(0, 4);
  if (ys === ye && Math.floor((ms - 1) / 3) === Math.floor((me - 1) / 3) &&
      start.slice(8, 10) === "01") {
    return `${ys}-Q${Math.floor((ms - 1) / 3) + 1}`;
  }
  if (ys === ye && ms === me) return start.slice(0, 7);
  return `${start}_to_${end}`;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): Uint8Array {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  // UTF-8 BOM for Excel/Odoo friendliness
  const text = "\ufeff" + lines.join("\r\n") + "\r\n";
  return new TextEncoder().encode(text);
}

function badRequest(msg: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function loadTenantSlug(sb: ReturnType<typeof createClient>, id: string): Promise<{ slug: string; name: string }> {
  const { data, error } = await sb.from("tenants").select("name,slug").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(`tenant ${id} not found`);
  return { slug: slugify((data as any).slug || (data as any).name), name: (data as any).name ?? "" };
}

export async function buildOdooZip(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ buffer: Uint8Array; filename: string }> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { slug } = await loadTenantSlug(sb, tenantId);

  // Pull invoices for period (sent + paid; skip drafts)
  const { data: invoices, error: invErr } = await sb
    .from("invoices")
    .select(`
      id, invoice_number, issue_date, due_date, customer_id, vat_regime,
      ogm_reference, subtotal, tax_amount, total, order_id
    `)
    .eq("tenant_id", tenantId)
    .gte("issue_date", periodStart)
    .lte("issue_date", periodEnd)
    .in("status", ["sent", "paid"])
    .order("issue_date", { ascending: true });
  if (invErr) throw new Error(`invoices query failed: ${invErr.message}`);

  const invoiceList = (invoices ?? []) as Array<Record<string, any>>;
  const invoiceIds = invoiceList.map((i) => i.id);

  // Fallback: marketplace/guest invoices have NULL customer_id but the
  // linked order carries customer_email — use a stable email-derived ref.
  const orderIds = Array.from(
    new Set(invoiceList.filter((i) => !i.customer_id && i.order_id).map((i) => i.order_id)),
  );
  const orderEmailById = new Map<string, string>();
  if (orderIds.length > 0) {
    const { data: orders, error: ordErr } = await sb
      .from("orders")
      .select("id, customer_email")
      .in("id", orderIds);
    if (ordErr) throw new Error(`orders query failed: ${ordErr.message}`);
    for (const o of (orders ?? []) as Array<Record<string, any>>) {
      if (o.customer_email) orderEmailById.set(o.id, String(o.customer_email).toLowerCase());
    }
  }
  const customerRef = (inv: Record<string, any>): string => {
    if (inv.customer_id) return `sellqo_customer_${inv.customer_id}`;
    const email = inv.order_id ? orderEmailById.get(inv.order_id) : undefined;
    if (email) {
      const sanitized = email.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (sanitized) return `sellqo_customer_email_${sanitized}`;
    }
    return "";
  };

  const linesById = new Map<string, Array<Record<string, any>>>();
  if (invoiceIds.length > 0) {
    const { data: lines, error: lnErr } = await sb
      .from("invoice_lines")
      .select(`
        id, invoice_id, line_type, product_id, description,
        quantity, unit_price, vat_rate, discount_percentage, line_total, sort_order
      `)
      .in("invoice_id", invoiceIds)
      .order("sort_order", { ascending: true });
    if (lnErr) throw new Error(`invoice_lines query failed: ${lnErr.message}`);
    for (const l of (lines ?? []) as Array<Record<string, any>>) {
      const arr = linesById.get(l.invoice_id) ?? [];
      arr.push(l);
      linesById.set(l.invoice_id, arr);
    }
  }

  // CSV 1: invoices.csv
  const invHeaders = [
    "External ID", "Customer", "Invoice Date", "Due Date", "Currency",
    "Journal", "Communication", "Salesperson", "Source Document",
  ];
  const invRows = invoiceList.map((inv) => [
    `sellqo_invoice_${inv.id}`,
    customerRef(inv),
    String(inv.issue_date ?? "").slice(0, 10),
    inv.due_date ? String(inv.due_date).slice(0, 10) : "",
    "EUR",
    "Sales Journal",
    inv.ogm_reference ?? "",
    "", // Salesperson
    inv.invoice_number ?? "",
  ]);
  const invCsv = toCsv(invHeaders, invRows);

  // CSV 2: invoice_lines.csv
  const lineHeaders = [
    "Invoice External ID", "Product", "Description", "Account",
    "Quantity", "Unit Price", "Discount", "Taxes",
  ];
  const lineRows: (string | number | null)[][] = [];
  for (const inv of invoiceList) {
    const regime = String(inv.vat_regime ?? "domestic_standard");
    const map = REGIME_MAP[regime] ?? REGIME_MAP.domestic_standard;
    const arr = linesById.get(inv.id) ?? [];
    for (const l of arr) {
      const product = l.line_type === "product" && l.product_id
        ? `sellqo_product_${l.product_id}`
        : "Manual";
      lineRows.push([
        `sellqo_invoice_${inv.id}`,
        product,
        l.description ?? "",
        map.account,
        Number(l.quantity ?? 0),
        Number(l.unit_price ?? 0).toFixed(2),
        l.discount_percentage != null ? Number(l.discount_percentage).toFixed(2) : "0.00",
        map.tax,
      ]);
    }
  }
  const lineCsv = toCsv(lineHeaders, lineRows);

  const code = periodCode(periodStart, periodEnd);
  const invName = `SellQo_Odoo_invoices_${slug}_${code}.csv`;
  const lineName = `SellQo_Odoo_invoice_lines_${slug}_${code}.csv`;

  const zip = new JSZip();
  zip.file(invName, invCsv);
  zip.file(lineName, lineCsv);
  const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  return {
    buffer,
    filename: `SellQo_Odoo_Import_${slug}_${code}.zip`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest("Invalid JSON body", cors); }
  const b = (raw ?? {}) as Record<string, unknown>;
  if (typeof b.tenant_id !== "string") return badRequest("tenant_id required", cors);
  if (typeof b.period_start !== "string" || !ISO_DATE.test(b.period_start)) return badRequest("period_start invalid", cors);
  if (typeof b.period_end !== "string" || !ISO_DATE.test(b.period_end)) return badRequest("period_end invalid", cors);
  const body: ReqBody = {
    tenant_id: b.tenant_id, period_start: b.period_start, period_end: b.period_end,
  };

  try {
    await authenticateRequest(req, body.tenant_id);
    const { buffer, filename } = await buildOdooZip(body.tenant_id, body.period_start, body.period_end);
    return new Response(buffer, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Access-Control-Expose-Headers": "Content-Disposition",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("[export-odoo-csv] error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
// export-q-bundle — bundles every quarterly deliverable for the accountant
// (XLSX overview, PDF report, INTERVAT XML, IC-listing XML, Odoo CSV import,
// invoice PDFs, audit trail CSV, README) into a single ZIP.
// Admin-only (JWT verified). Returns ZIP as binary download.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type PeriodType = "monthly" | "quarterly" | "annual" | "custom";

interface ReqBody {
  tenant_id: string;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
  include_invoice_pdfs: boolean;
  include_ubls: boolean;
}

function slugify(s: string): string {
  return (s || "tenant").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 60) || "tenant";
}

function periodCode(start: string, end: string, type: PeriodType): string {
  const y = start.slice(0, 4);
  if (type === "annual") return y;
  if (type === "monthly") return start.slice(0, 7);
  if (type === "quarterly") {
    const m = parseInt(start.slice(5, 7), 10);
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  }
  return `${start}_to_${end}`;
}

function periodLabelNl(start: string, end: string, type: PeriodType): string {
  if (type === "quarterly") {
    const y = start.slice(0, 4);
    const m = parseInt(start.slice(5, 7), 10);
    return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  }
  if (type === "monthly") return start.slice(0, 7);
  if (type === "annual") return start.slice(0, 4);
  return `${start} t/m ${end}`;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function badRequest(msg: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface FetchedDoc { name: string; bytes: Uint8Array; }

async function callInternal(
  fnName: string,
  body: Record<string, unknown>,
): Promise<Uint8Array> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resp = await fetch(`${url}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`${fnName} failed: ${resp.status} ${txt.slice(0, 200)}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}

/** Best-effort settled wrapper that captures failures so the bundle still ships. */
async function tryFetch(label: string, p: Promise<Uint8Array>): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  try {
    const bytes = await p;
    return { ok: true, bytes };
  } catch (e) {
    console.error(`[q-bundle] ${label} failed`, e);
    return { ok: false, error: (e as Error).message };
  }
}

function buildReadme(opts: {
  tenantName: string;
  periodLabel: string;
  periodCode: string;
  generatedAt: string;
  invoicePdfCount: number;
  failures: Array<{ doc: string; error: string }>;
}): Uint8Array {
  const lines: string[] = [];
  lines.push(`SellQo Q-Pakket — ${opts.tenantName}`);
  lines.push(`Periode: ${opts.periodLabel} (code ${opts.periodCode})`);
  lines.push(`Gegenereerd: ${opts.generatedAt}`);
  lines.push("");
  lines.push("INHOUD VAN DIT PAKKET");
  lines.push("---------------------");
  lines.push("01_BTW-aangifte_overzicht.xlsx   Excel met 9 tabs (aangifte-formulier, audit, per tarief, per land, IC, OSS, creditnota's, Stripe-reconciliatie, validatie).");
  lines.push("02_BTW-aangifte_rapport.pdf      Geprinte versie voor dossier en e-mail.");
  lines.push("03_INTERVAT_BTW-aangifte.xml     Klaar voor directe upload op https://intervat.minfin.fgov.be (formulier 625).");
  lines.push("04_INTERVAT_IC-Listing.xml       Klaar voor directe upload op INTERVAT (formulier 723 — alleen indienen indien er IC-leveringen zijn).");
  lines.push("05_Odoo_import/                  CSV's voor één-klik import in Odoo (l10n_be). Importeer invoices.csv eerst, daarna invoice_lines.csv.");
  lines.push(`06_Factuur_PDFs/                 ${opts.invoicePdfCount} factuur-PDFs uit Supabase Storage. Bewaar voor wettelijke archiveringsplicht (7 jaar).`);
  lines.push("07_Audit_trail.csv               Volledige regel-per-regel onderbouwing per BTW-vak en regime.");
  lines.push("");
  lines.push("INDIENING (Belgische BTW-plichtige)");
  lines.push("-----------------------------------");
  lines.push("1. Open INTERVAT (https://intervat.minfin.fgov.be) met eID of Itsme.");
  lines.push("2. Upload 03_INTERVAT_BTW-aangifte.xml via 'Aangifte indienen → XML opladen'.");
  lines.push("3. (Indien IC-leveringen) Upload 04_INTERVAT_IC-Listing.xml via 'Klantenlisting → XML opladen'.");
  lines.push("4. Cross-check bedragen met 01_BTW-aangifte_overzicht.xlsx (tab 'Aangifte-formulier').");
  lines.push("5. Bevestig en betaal eventueel verschuldigd saldo (vak 71) vóór de uiterste datum.");
  lines.push("");
  lines.push("BOEKHOUDING (Odoo)");
  lines.push("------------------");
  lines.push("Importeer in deze volgorde via 'Boekhouding → Configuratie → Importeren':");
  lines.push("  a) 05_Odoo_import/SellQo_Odoo_invoices_*.csv");
  lines.push("  b) 05_Odoo_import/SellQo_Odoo_invoice_lines_*.csv");
  lines.push("Klanten en producten worden gematcht via 'External ID' (sellqo_customer_<uuid> / sellqo_product_<uuid>).");
  lines.push("Accounts (700000-reeks) en taxes (l10n_be.*) zijn vooraf ingevuld per BTW-regime.");
  lines.push("");
  if (opts.failures.length) {
    lines.push("WAARSCHUWINGEN");
    lines.push("--------------");
    for (const f of opts.failures) lines.push(`- ${f.doc}: ${f.error}`);
    lines.push("");
  }
  lines.push("VRAGEN");
  lines.push("------");
  lines.push("Mail support@sellqo.com met als onderwerp 'Q-Pakket ${'${opts.periodCode}'}'.");
  lines.push("");
  lines.push("— SellQo, geautomatiseerde accounting export");
  return new TextEncoder().encode(lines.join("\r\n") + "\r\n");
}

function buildAuditCsv(payload: Record<string, unknown>): Uint8Array {
  const trail = (payload.audit_trail ?? []) as Array<Record<string, unknown>>;
  const headers = [
    "invoice_number", "issue_date", "customer", "vat_regime",
    "declaration_box", "base_amount", "vat_amount", "is_credit_note",
  ];
  const lines = [headers.join(",")];
  for (const r of trail) {
    lines.push([
      csvEscape(r.invoice_number),
      csvEscape(String(r.issue_date ?? "").slice(0, 10)),
      csvEscape(r.customer),
      csvEscape(r.vat_regime),
      csvEscape(r.declaration_box),
      csvEscape(Number(r.base_amount ?? 0).toFixed(2)),
      csvEscape(Number(r.vat_amount ?? 0).toFixed(2)),
      csvEscape(r.is_credit_note ? "true" : "false"),
    ].join(","));
  }
  return new TextEncoder().encode("\ufeff" + lines.join("\r\n") + "\r\n");
}

async function fetchInvoicePdfs(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  start: string,
  end: string,
): Promise<FetchedDoc[]> {
  const { data, error } = await sb
    .from("invoices")
    .select("invoice_number, pdf_url")
    .eq("tenant_id", tenantId)
    .gte("issue_date", start)
    .lte("issue_date", end)
    .in("status", ["sent", "paid"])
    .not("pdf_url", "is", null);
  if (error) throw new Error(`pdf_url query failed: ${error.message}`);
  const out: FetchedDoc[] = [];
  const list = (data ?? []) as Array<{ invoice_number: string; pdf_url: string }>;
  // Fetch in parallel batches of 8 to avoid hammering Storage
  const batchSize = 8;
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(async (row) => {
      const resp = await fetch(row.pdf_url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = new Uint8Array(await resp.arrayBuffer());
      const ext = row.pdf_url.split(".").pop()?.toLowerCase() === "html" ? "html" : "pdf";
      return { name: `${row.invoice_number}.${ext}`, bytes: buf };
    }));
    for (const r of results) {
      if (r.status === "fulfilled") out.push(r.value);
      else console.warn("[q-bundle] pdf fetch failed", r.reason);
    }
  }
  return out;
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
  const pt = String(b.period_type ?? "quarterly") as PeriodType;
  if (!["monthly","quarterly","annual","custom"].includes(pt)) return badRequest("period_type invalid", cors);
  const body: ReqBody = {
    tenant_id: b.tenant_id,
    period_start: b.period_start,
    period_end: b.period_end,
    period_type: pt,
    include_invoice_pdfs: b.include_invoice_pdfs !== false,
    include_ubls: b.include_ubls === true,
  };

  try {
    await authenticateRequest(req, body.tenant_id);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: t, error: tErr } = await sb
      .from("tenants").select("name,slug").eq("id", body.tenant_id).maybeSingle();
    if (tErr || !t) throw new Error(`tenant ${body.tenant_id} not found`);
    const tenant = t as { name: string | null; slug: string | null };
    const slug = slugify(tenant.slug || tenant.name || "tenant");
    const code = periodCode(body.period_start, body.period_end, body.period_type);

    const engineBody = {
      tenant_id: body.tenant_id,
      period_start: body.period_start,
      period_end: body.period_end,
      period_type: body.period_type,
    };

    // Fan out all exporters in parallel. Also pull audit payload directly
    // from the engine for the audit CSV (the XLSX engine already includes it,
    // but we want the raw payload for trail.csv generation).
    const enginePromise = (async () => {
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${url}/functions/v1/vat-report-engine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "apikey": key,
        },
        body: JSON.stringify({ ...engineBody, include_audit_trail: true, force_recompute: true }),
      });
      if (!r.ok) throw new Error(`vat-report-engine ${r.status}`);
      const j = await r.json();
      if (!j?.success) throw new Error(`vat-report-engine ${j?.error ?? "error"}`);
      return j.payload as Record<string, unknown>;
    })();

    const [xlsxR, pdfR, vatXmlR, icXmlR, odooR, enginePayload, invoicePdfs] = await Promise.all([
      tryFetch("xlsx", callInternal("export-vat-xlsx", engineBody)),
      tryFetch("pdf", callInternal("export-vat-pdf", engineBody)),
      tryFetch("vat-xml", callInternal("export-vat-xml", engineBody)),
      tryFetch("ic-xml", callInternal("export-ic-listing-xml", engineBody)),
      tryFetch("odoo-csv", callInternal("export-odoo-csv", {
        tenant_id: body.tenant_id, period_start: body.period_start, period_end: body.period_end,
      })),
      enginePromise.catch((e) => { console.error("[q-bundle] engine failed", e); return null; }),
      body.include_invoice_pdfs
        ? fetchInvoicePdfs(sb, body.tenant_id, body.period_start, body.period_end)
          .catch((e) => { console.error("[q-bundle] invoice pdfs failed", e); return [] as FetchedDoc[]; })
        : Promise.resolve([] as FetchedDoc[]),
    ]);

    const failures: Array<{ doc: string; error: string }> = [];
    const zip = new JSZip();

    if (xlsxR.ok) zip.file("01_BTW-aangifte_overzicht.xlsx", xlsxR.bytes);
    else failures.push({ doc: "01_BTW-aangifte_overzicht.xlsx", error: xlsxR.error });

    if (pdfR.ok) zip.file("02_BTW-aangifte_rapport.pdf", pdfR.bytes);
    else failures.push({ doc: "02_BTW-aangifte_rapport.pdf", error: pdfR.error });

    if (vatXmlR.ok) zip.file("03_INTERVAT_BTW-aangifte.xml", vatXmlR.bytes);
    else failures.push({ doc: "03_INTERVAT_BTW-aangifte.xml", error: vatXmlR.error });

    if (icXmlR.ok) zip.file("04_INTERVAT_IC-Listing.xml", icXmlR.bytes);
    else failures.push({ doc: "04_INTERVAT_IC-Listing.xml", error: icXmlR.error });

    // Odoo export returns its own ZIP — unpack and place under 05_Odoo_import/
    if (odooR.ok) {
      try {
        const inner = await JSZip.loadAsync(odooR.bytes);
        const files = Object.keys(inner.files);
        for (const fname of files) {
          if (inner.files[fname].dir) continue;
          const bytes = await inner.files[fname].async("uint8array");
          zip.file(`05_Odoo_import/${fname}`, bytes);
        }
      } catch (e) {
        failures.push({ doc: "05_Odoo_import", error: (e as Error).message });
      }
    } else {
      failures.push({ doc: "05_Odoo_import", error: odooR.error });
    }

    if (body.include_invoice_pdfs) {
      for (const d of invoicePdfs) zip.file(`06_Factuur_PDFs/${d.name}`, d.bytes);
    }

    if (enginePayload) {
      zip.file("07_Audit_trail.csv", buildAuditCsv(enginePayload));
    } else {
      failures.push({ doc: "07_Audit_trail.csv", error: "vat-report-engine failed" });
    }

    zip.file("README.txt", buildReadme({
      tenantName: tenant.name ?? "Tenant",
      periodLabel: periodLabelNl(body.period_start, body.period_end, body.period_type),
      periodCode: code,
      generatedAt: new Date().toISOString(),
      invoicePdfCount: invoicePdfs.length,
      failures,
    }));

    const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const filename = `SellQo_Q-Pakket_${slug}_${code}.zip`;

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
    console.error("[export-q-bundle] error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
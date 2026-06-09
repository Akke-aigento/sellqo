// export-vat-xml — generates an INTERVAT-compliant XML for the periodic
// VAT declaration (formulier 625) from vat-report-engine output.
// Admin-only (JWT verified). Returns the XML as a text/xml download.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError, requireRole } from "../_shared/auth.ts";
import {
  PeriodType,
  callVatEngine,
  declarantXml,
  fmtDecimal,
  loadTenantInfo,
  periodCode,
  periodXml,
  resolveIntervatPeriod,
  slugify,
  declarantReference,
  assertWellFormedXml,
} from "../_shared/intervat.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReqBody {
  tenant_id: string;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
}

// INTERVAT grid numbers that may carry an Amount on a sales/purchase basis
// (vakken 00..49, 81..88) and VAT-due/recoverable grids (54..72).
const ALLOWED_GRIDS = new Set([
  "00","01","02","03",
  "44","45","46","47","48","49",
  "54","55","56","57","59","61","62","63","64",
  "71","72",
  "81","82","83","84","85","86","87","88",
]);
const VAT_DUE_GRIDS = new Set(["54","55","56","57","59","61","62","63","64","71","72"]);

function badRequest(msg: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
}

function buildVatConsignment(
  payload: Record<string, unknown>,
  tenant: Awaited<ReturnType<typeof loadTenantInfo>>,
  body: ReqBody,
): { xml: string; filename: string } {
  const period = resolveIntervatPeriod(body.period_start, body.period_end, body.period_type);
  const ref = declarantReference("SQ-V", tenant.id, periodCode(period));

  // Collect non-zero amounts per grid.
  const boxes = (payload.declaration_boxes ?? {}) as Record<
    string,
    { amount: number; vat: number }
  >;
  type GridLine = { grid: string; value: number };
  const lines: GridLine[] = [];
  for (const grid of Array.from(ALLOWED_GRIDS).sort()) {
    const b = boxes[grid];
    if (!b) continue;
    const v = VAT_DUE_GRIDS.has(grid) ? Number(b.vat ?? 0) : Number(b.amount ?? 0);
    const rounded = Math.round((v + Number.EPSILON) * 100) / 100;
    if (Math.abs(rounded) >= 0.01) lines.push({ grid, value: rounded });
  }

  const icListing = (payload.ic_listing ?? []) as Array<Record<string, unknown>>;
  const clientListingNihil = icListing.length === 0 ? "true" : "false";

  const indent = "    ";
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<ns2:VATConsignment xmlns:ns2="http://www.minfin.fgov.be/InputCommon"'
      + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
      + ' VATDeclarationsNbr="1">',
  );
  out.push(`  <ns2:VATDeclaration SequenceNumber="1" DeclarantReference="${ref}">`);
  out.push(declarantXml(tenant, indent));
  out.push(periodXml(period, indent));
  out.push(`${indent}<ns2:Data>`);
  for (const { grid, value } of lines) {
    // INTERVAT spec: amounts on grids 71/72 must always be ≥ 0; we already
    // filtered to non-zero values; engine derives 71 vs 72 by sign.
    out.push(`${indent}  <Amount GridNumber="${grid}">${fmtDecimal(Math.abs(value))}</Amount>`);
  }
  out.push(`${indent}</ns2:Data>`);
  out.push(`${indent}<ns2:ClientListingNihil>${clientListingNihil}</ns2:ClientListingNihil>`);
  out.push(`  </ns2:VATDeclaration>`);
  out.push(`</ns2:VATConsignment>`);

  const xml = out.join("\n");
  assertWellFormedXml(xml);

  // Structural XSD-mirror checks
  if (lines.length === 0) {
    throw new Error("VAT declaration has no non-zero grids — cannot file empty declaration");
  }

  const filename = `SellQo_INTERVAT_BTW-aangifte_${
    slugify(tenant.slug || tenant.name)
  }_${periodCode(period)}.xml`;
  return { xml, filename };
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
  const pt = String(b.period_type ?? "custom") as PeriodType;
  if (!["monthly","quarterly","annual","custom"].includes(pt)) return badRequest("period_type invalid", cors);
  const body: ReqBody = {
    tenant_id: b.tenant_id,
    period_start: b.period_start,
    period_end: b.period_end,
    period_type: pt,
  };

  try {
    const auth = await authenticateRequest(req, body.tenant_id);
    requireRole(auth, body.tenant_id, ['tenant_admin', 'accountant']);

    const [tenant, payload] = await Promise.all([
      loadTenantInfo(body.tenant_id),
      callVatEngine(body),
    ]);

    const { xml, filename } = buildVatConsignment(payload, tenant, body);

    return new Response(xml, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Access-Control-Expose-Headers": "Content-Disposition",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("[export-vat-xml] error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
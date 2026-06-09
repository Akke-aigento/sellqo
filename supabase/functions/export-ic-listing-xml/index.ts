// export-ic-listing-xml — generates an INTERVAT-compliant XML for the
// intra-community client listing (formulier 723) from vat-report-engine
// output. Admin-only (JWT verified). Returns XML as text/xml download.

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
  splitForeignVat,
  declarantReference,
  assertWellFormedXml,
  xmlEscape,
} from "../_shared/intervat.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReqBody {
  tenant_id: string;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
}

interface IcEntry {
  vat_number: string;
  country_code: string;
  company_name: string;
  amount: number;
  type_code: "L" | "T" | "S";
}

function badRequest(msg: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
}

function buildIntraConsignment(
  payload: Record<string, unknown>,
  tenant: Awaited<ReturnType<typeof loadTenantInfo>>,
  body: ReqBody,
): { xml: string; filename: string; clients: number; sum: number } {
  const period = resolveIntervatPeriod(body.period_start, body.period_end, body.period_type);
  const ref = declarantReference("SQ-IC", tenant.id, periodCode(period));

  const raw = (payload.ic_listing ?? []) as Array<Record<string, unknown>>;
  const entries: IcEntry[] = raw.map((r) => ({
    vat_number: String(r.vat_number ?? "").toUpperCase().replace(/\s+/g, ""),
    country_code: String(r.country_code ?? "").toUpperCase(),
    company_name: String(r.company_name ?? ""),
    amount: Math.round((Number(r.amount ?? 0) + Number.EPSILON) * 100) / 100,
    type_code: (r.type_code as "L" | "T" | "S") ?? "L",
  })).filter((e) => Math.abs(e.amount) >= 0.01);

  // INTERVAT requires positive amounts; aggregate by VAT+code to avoid splits.
  const merged = new Map<string, IcEntry>();
  for (const e of entries) {
    const key = `${e.vat_number}::${e.type_code}`;
    const ex = merged.get(key);
    if (ex) {
      ex.amount = Math.round((ex.amount + e.amount + Number.EPSILON) * 100) / 100;
    } else {
      merged.set(key, { ...e });
    }
  }
  const sorted = Array.from(merged.values())
    .filter((e) => e.amount > 0)
    .sort((a, b) => a.vat_number.localeCompare(b.vat_number));

  const sum = sorted.reduce((acc, e) => acc + e.amount, 0);
  const sumRounded = Math.round((sum + Number.EPSILON) * 100) / 100;

  const indent = "    ";
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<ns2:IntraConsignment xmlns:ns2="http://www.minfin.fgov.be/InputCommon"'
      + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
      + ' IntraListingsNbr="1">',
  );
  out.push(
    `  <ns2:IntraListing SequenceNumber="1" DeclarantReference="${ref}"`
      + ` ClientsNbr="${sorted.length}" AmountSum="${fmtDecimal(sumRounded)}">`,
  );
  out.push(declarantXml(tenant, indent));
  out.push(periodXml(period, indent));

  sorted.forEach((e, idx) => {
    // Validate and split foreign VAT
    const { country, number } = splitForeignVat(e.vat_number);
    if (country !== e.country_code && e.country_code) {
      // Trust the VAT-number prefix (XSD constraint); just log.
      console.warn(`[ic-listing] entry ${e.vat_number} country mismatch: ${country} vs ${e.country_code}`);
    }
    if (!["L", "T", "S"].includes(e.type_code)) {
      throw new Error(`invalid IC type code "${e.type_code}" for ${e.vat_number}`);
    }
    out.push(`${indent}<ns2:IntraClient SequenceNumber="${idx + 1}">`);
    out.push(`${indent}  <ns2:CompanyVATNumber issuedBy="${country}">${number}</ns2:CompanyVATNumber>`);
    out.push(`${indent}  <ns2:Code>${e.type_code}</ns2:Code>`);
    out.push(`${indent}  <ns2:Amount>${fmtDecimal(e.amount)}</ns2:Amount>`);
    out.push(`${indent}</ns2:IntraClient>`);
  });

  out.push(`  </ns2:IntraListing>`);
  out.push(`</ns2:IntraConsignment>`);

  const xml = out.join("\n");
  assertWellFormedXml(xml);

  const filename = `SellQo_INTERVAT_IC-Listing_${
    slugify(tenant.slug || tenant.name)
  }_${periodCode(period)}.xml`;
  return { xml, filename, clients: sorted.length, sum: sumRounded };
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

    const { xml, filename } = buildIntraConsignment(payload, tenant, body);
    // touch xmlEscape import (avoid unused warning if not directly used here)
    void xmlEscape;

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
    console.error("[export-ic-listing-xml] error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
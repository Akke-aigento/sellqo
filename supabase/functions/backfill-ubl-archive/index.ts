/**
 * Fase 4.2 — Backfill historical UBL archive.
 *
 * Generates BIS 3.0 UBL XML for all B2B invoices issued since `since_date`
 * that don't yet have an archived UBL. Idempotent: invoices that already
 * have a Peppol UBL are skipped.
 *
 * Input:  { tenant_id?: string, since_date?: string (YYYY-MM-DD, default 2026-01-01), dry_run?: boolean }
 * Output: { total_invoices, generated, skipped, errors: [{ invoice_id, error }] }
 *
 * Auth: JWT — platform admins, OR tenant members of the targeted tenant.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCorsOptions, getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PEPPOL_REGIMES = [
  "domestic_standard",
  "domestic_reduced_6",
  "domestic_reduced_12",
  "ic_supply_goods",
  "ic_supply_services",
  "ic_triangulation",
  "ic_supply_triangulation",
  "reverse_charge_construction",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  let body: { tenant_id?: string; since_date?: string; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const tenantId = body.tenant_id?.trim() || null;
  const sinceDate = (body.since_date || "2026-01-01").trim();
  const dryRun = Boolean(body.dry_run);

  // Auth: must be admin of the targeted tenant, or platform admin.
  let auth;
  try {
    auth = await authenticateRequest(req, tenantId ?? undefined);
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    throw e;
  }
  if (!tenantId && !auth.is_platform_admin) {
    return new Response(JSON.stringify({ success: false, error: "tenant_id required for non-platform-admin" }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch candidate invoices.
  let q = sb.from("invoices")
    .select("id, tenant_id, invoice_number, vat_regime, ubl_url, status, issue_date")
    .gte("issue_date", sinceDate)
    .in("vat_regime", PEPPOL_REGIMES)
    .in("status", ["sent", "paid"])
    .order("issue_date", { ascending: true });

  if (tenantId) q = q.eq("tenant_id", tenantId);

  const { data: rows, error: qErr } = await q;
  if (qErr) {
    return new Response(JSON.stringify({ success: false, error: qErr.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Filter: only those missing UBL or non-BIS3 URL.
  const candidates = (rows ?? []).filter((r) => {
    const u = (r.ubl_url ?? "").toLowerCase();
    return !u || !u.includes("peppol-archive");
  });

  const result = {
    success: true,
    dry_run: dryRun,
    since_date: sinceDate,
    tenant_id: tenantId,
    total_invoices: candidates.length,
    generated: 0,
    skipped: 0,
    errors: [] as Array<{ invoice_id: string; invoice_number?: string; error: string }>,
    preview: dryRun
      ? candidates.slice(0, 50).map((r) => ({
          invoice_id: r.id,
          invoice_number: r.invoice_number,
          issue_date: r.issue_date,
          vat_regime: r.vat_regime,
        }))
      : undefined,
  };

  if (dryRun) {
    return new Response(JSON.stringify(result),
      { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Real run — call generate-peppol-ubl per invoice using service role auth.
  const generateUrl = `${SUPABASE_URL}/functions/v1/generate-peppol-ubl`;
  for (const inv of candidates) {
    try {
      const resp = await fetch(generateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ invoice_id: inv.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        result.errors.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          error: json?.error || `HTTP ${resp.status}`,
        });
        continue;
      }
      if (json?.skipped) {
        result.skipped += 1;
      } else {
        result.generated += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        error: msg,
      });
    }
  }

  return new Response(JSON.stringify(result),
    { headers: { ...cors, "Content-Type": "application/json" } });
});
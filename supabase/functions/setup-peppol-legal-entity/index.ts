/**
 * Fase 4.3 — Storecove LegalEntity registration.
 *
 * Registers the calling tenant as a LegalEntity at Storecove (Peppol Access
 * Point) and stores the returned ID on tenants.peppol_legal_entity_id.
 *
 * Input:  { tenant_id: string }
 * Output: { success, storecove_id, peppol_identifier }
 *
 * Idempotent: refuses to re-register if peppol_legal_entity_id is already set.
 * Auth: JWT — tenant admin only.
 * Required secret: STORECOVE_API_KEY (sandbox or production).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCorsOptions, getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORECOVE_API_KEY = Deno.env.get("STORECOVE_API_KEY");
const STORECOVE_BASE = Deno.env.get("STORECOVE_BASE_URL") || "https://api.storecove.com/api/v2";

// Peppol scheme IDs per ISO country.
const SCHEME_BY_COUNTRY: Record<string, string> = {
  BE: "0208", // KBO
  NL: "0106", // KvK
  DE: "0204",
  FR: "0009", // SIRET
  LU: "0208",
  AT: "9915",
  IT: "0201",
  ES: "0212",
  DK: "0184",
  SE: "0007",
};

function stripVatPrefix(vat: string | null | undefined): string {
  if (!vat) return "";
  return vat.replace(/^[A-Z]{2}/, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (!STORECOVE_API_KEY) {
    return new Response(JSON.stringify({
      success: false,
      error: "STORECOVE_API_KEY not configured. Contact platform administrator.",
    }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  }

  let body: { tenant_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const tenantId = (body.tenant_id ?? "").trim();
  if (!tenantId) {
    return new Response(JSON.stringify({ success: false, error: "tenant_id required" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    await authenticateRequest(req, tenantId);
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    throw e;
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: tenant, error: tErr } = await sb
    .from("tenants")
    .select("id, name, billing_company_name, kvk_number, btw_number, address, postal_code, city, country, owner_email, billing_email, peppol_legal_entity_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (tErr || !tenant) {
    return new Response(JSON.stringify({ success: false, error: "tenant not found" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Idempotency.
  if (tenant.peppol_legal_entity_id) {
    return new Response(JSON.stringify({
      success: true,
      already_registered: true,
      storecove_id: tenant.peppol_legal_entity_id,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  const country = (tenant.country ?? "BE").toUpperCase();
  const scheme = SCHEME_BY_COUNTRY[country] ?? "9925"; // 9925 = VAT fallback
  const identifier = scheme === "9925"
    ? stripVatPrefix(tenant.btw_number)
    : (tenant.kvk_number?.trim() || stripVatPrefix(tenant.btw_number));

  if (!identifier) {
    return new Response(JSON.stringify({
      success: false,
      error: "Missing KBO/VAT number on tenant. Fill in tenant business settings first.",
    }), { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const payload = {
    party_name: tenant.billing_company_name || tenant.name,
    line1: tenant.address ?? "",
    city: tenant.city ?? "",
    zip: tenant.postal_code ?? "",
    country,
    public: true,
    tax_registered: true,
    acts_as_sender: true,
    acts_as_receiver: true,
    peppol_identifiers: [{ scheme, identifier }],
  };

  const resp = await fetch(`${STORECOVE_BASE}/legal_entities`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STORECOVE_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("[setup-peppol-legal-entity] Storecove error", resp.status, json);
    return new Response(JSON.stringify({
      success: false,
      error: json?.error || json?.message || `Storecove HTTP ${resp.status}`,
      details: json,
    }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const storecoveId = json?.id ? String(json.id) : null;
  if (!storecoveId) {
    return new Response(JSON.stringify({
      success: false,
      error: "Storecove did not return a legal entity id",
      details: json,
    }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const peppolIdentifier = `${scheme}:${identifier}`;

  const { error: updErr } = await sb.from("tenants").update({
    peppol_legal_entity_id: storecoveId,
    peppol_id: peppolIdentifier,
  }).eq("id", tenantId);

  if (updErr) {
    return new Response(JSON.stringify({
      success: false,
      error: `Storecove registered (${storecoveId}) but DB update failed: ${updErr.message}`,
    }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    success: true,
    storecove_id: storecoveId,
    peppol_identifier: peppolIdentifier,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
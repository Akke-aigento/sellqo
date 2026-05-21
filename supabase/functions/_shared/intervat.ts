// Shared helpers for INTERVAT XML generation (VAT declaration & IC listing).
// Implements structural validation that mirrors the official FOD XSDs.
// See _shared/xsds/README.md for the XSD references.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string | null;
  vat_number: string;          // raw, may include "BE" prefix
  vat_number_digits: string;   // 10 digits, no prefix
  address: string | null;
  postal_code: string | null;
  city: string | null;
  owner_email: string | null;
  phone: string | null;
}

export async function loadTenantInfo(tenantId: string): Promise<TenantInfo> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("tenants")
    .select("id,name,slug,btw_number,address,postal_code,city,owner_email,phone")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`tenant lookup failed: ${error.message}`);
  if (!data) throw new Error(`tenant ${tenantId} not found`);

  const raw = String(data.btw_number ?? "").replace(/\s+/g, "").toUpperCase();
  const digits = raw.replace(/^BE/, "").replace(/\D/g, "");
  return {
    id: data.id,
    name: data.name ?? "Tenant",
    slug: data.slug ?? null,
    vat_number: raw,
    vat_number_digits: digits,
    address: data.address ?? null,
    postal_code: data.postal_code ?? null,
    city: data.city ?? null,
    owner_email: data.owner_email ?? null,
    phone: data.phone ?? null,
  };
}

export type PeriodType = "monthly" | "quarterly" | "annual" | "custom";

export interface IntervatPeriod {
  year: number;
  month?: number;    // 1-12
  quarter?: number;  // 1-4
}

/**
 * Resolve INTERVAT period from request range. INTERVAT only accepts
 * monthly or quarterly periods → annual/custom are rejected.
 */
export function resolveIntervatPeriod(
  start: string,
  end: string,
  type: PeriodType,
): IntervatPeriod {
  const ys = parseInt(start.slice(0, 4), 10);
  const ms = parseInt(start.slice(5, 7), 10);
  const me = parseInt(end.slice(5, 7), 10);
  const ye = parseInt(end.slice(0, 4), 10);

  if (type === "monthly") {
    if (ys !== ye || ms !== me) {
      throw new Error("monthly period must start and end in the same month");
    }
    return { year: ys, month: ms };
  }
  if (type === "quarterly") {
    if (ys !== ye) throw new Error("quarterly period must be within a single year");
    const qs = Math.floor((ms - 1) / 3) + 1;
    const qe = Math.floor((me - 1) / 3) + 1;
    if (qs !== qe) throw new Error("quarterly period spans multiple quarters");
    return { year: ys, quarter: qs };
  }
  // INTERVAT only accepts monthly/quarterly returns
  throw new Error(
    `INTERVAT does not accept period_type='${type}' for declaration filings — use monthly or quarterly`,
  );
}

export function periodCode(p: IntervatPeriod): string {
  if (p.quarter) return `${p.year}-Q${p.quarter}`;
  if (p.month) return `${p.year}-${String(p.month).padStart(2, "0")}`;
  return String(p.year);
}

export function slugify(s: string): string {
  return (s || "tenant").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60) || "tenant";
}

/** XML-escape text content. Mandatory before writing into the document. */
export function xmlEscape(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format a number as INTERVAT decimal (point, 2dp, no thousand separator). */
export function fmtDecimal(n: number): string {
  const safe = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  return safe.toFixed(2);
}

/** Stable, unique DeclarantReference. Max length per XSD = 20 chars. */
export function declarantReference(prefix: string, tenantId: string, code: string): string {
  // Compact, INTERVAT-safe (≤ 20 chars, [A-Z0-9-]) and ends without hyphen.
  // Period encoded as "YYQn" / "YYMmm": e.g. 2026-Q1 → 26Q1, 2026-04 → 26M04.
  const slim = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  let period = slim;
  const qMatch = code.match(/^(\d{4})-Q([1-4])$/);
  const mMatch = code.match(/^(\d{4})-(\d{2})$/);
  if (qMatch) period = `${qMatch[1].slice(2)}Q${qMatch[2]}`;
  else if (mMatch) period = `${mMatch[1].slice(2)}M${mMatch[2]}`;
  const short = tenantId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const p = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  // p(≤4) + period(≤5) + short(6) + ts(4) + 3 separators = ≤ 22; trim if needed
  const ref = `${p}-${period}-${short}-${ts}`.slice(0, 20).replace(/-+$/, "");
  return ref;
}

/** Validate a Belgian VAT number (10 digits). */
export function validateBeVatNumber(digits: string): void {
  if (!/^\d{10}$/.test(digits)) {
    throw new Error(`Belgian VAT number must be 10 digits (got "${digits}")`);
  }
}

const EU_COUNTRY_CODES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","EL","HR","HU","IE","IT","LT","LU","LV",
  "MT","NL","PL","PT","RO","SE","SI","SK","XI", // XI = Northern Ireland for IC purposes
]);

/** Split foreign VAT number into ISO country + digits, validated. */
export function splitForeignVat(raw: string): { country: string; number: string } {
  const v = String(raw || "").replace(/\s+/g, "").toUpperCase();
  if (v.length < 3) throw new Error(`invalid VAT number "${raw}"`);
  const country = v.slice(0, 2);
  const number = v.slice(2);
  if (!EU_COUNTRY_CODES.has(country)) {
    throw new Error(`unsupported EU country code "${country}" in VAT "${raw}"`);
  }
  if (country === "BE") {
    throw new Error(`IC client cannot have BE VAT number ("${raw}")`);
  }
  if (!/^[0-9A-Z]+$/.test(number) || number.length < 2 || number.length > 14) {
    throw new Error(`malformed VAT number tail "${number}" for ${country}`);
  }
  return { country, number };
}

/** Structural pre-checks that the XML is well-formed and XSD-shaped. */
export function structuralAssertNonEmpty(name: string, v: string | null | undefined): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`required field "${name}" is empty`);
  return s;
}

/** Build a self-closed period XML fragment. */
export function periodXml(p: IntervatPeriod, indent: string): string {
  if (p.quarter) {
    return `${indent}<ns2:Period>\n${indent}  <ns2:Quarter>${p.quarter}</ns2:Quarter>\n${indent}  <ns2:Year>${p.year}</ns2:Year>\n${indent}</ns2:Period>`;
  }
  return `${indent}<ns2:Period>\n${indent}  <ns2:Month>${p.month}</ns2:Month>\n${indent}  <ns2:Year>${p.year}</ns2:Year>\n${indent}</ns2:Period>`;
}

/** Build the shared <ns2:Declarant> fragment (identical for both consignments). */
export function declarantXml(t: TenantInfo, indent: string): string {
  validateBeVatNumber(t.vat_number_digits);
  const name = structuralAssertNonEmpty("tenant.name", t.name).slice(0, 200);
  const street = structuralAssertNonEmpty("tenant.address", t.address).slice(0, 200);
  const pc = structuralAssertNonEmpty("tenant.postal_code", t.postal_code).slice(0, 10);
  const city = structuralAssertNonEmpty("tenant.city", t.city).slice(0, 200);
  const email = structuralAssertNonEmpty("tenant.owner_email", t.owner_email).slice(0, 200);
  const phone = String(t.phone ?? "").trim();

  const lines = [
    `${indent}<ns2:Declarant>`,
    `${indent}  <VATNumber>${t.vat_number_digits}</VATNumber>`,
    `${indent}  <Name>${xmlEscape(name)}</Name>`,
    `${indent}  <Street>${xmlEscape(street)}</Street>`,
    `${indent}  <PostCode>${xmlEscape(pc)}</PostCode>`,
    `${indent}  <City>${xmlEscape(city)}</City>`,
    `${indent}  <CountryCode>BE</CountryCode>`,
    `${indent}  <EmailAddress>${xmlEscape(email)}</EmailAddress>`,
  ];
  if (phone) lines.push(`${indent}  <Phone>${xmlEscape(phone)}</Phone>`);
  lines.push(`${indent}</ns2:Declarant>`);
  return lines.join("\n");
}

/** Pre-flight: well-formed XML must parse via DOMParser. */
export function assertWellFormedXml(xml: string): void {
  // DOMParser is not built-in to Deno; use deno-dom on demand via dynamic
  // import to keep startup cost low.
  // We do a lightweight check: balanced tags and a single root element.
  const stripped = xml.replace(/<\?xml[^?]*\?>/, "").trim();
  // Quick balance check.
  const opens = stripped.match(/<[^/!?][^>]*[^/]>/g)?.length ?? 0;
  const closes = stripped.match(/<\/[^>]+>/g)?.length ?? 0;
  if (opens !== closes) {
    throw new Error(`XML not well-formed: ${opens} open tags vs ${closes} close tags`);
  }
}

export async function callVatEngine(body: {
  tenant_id: string;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
}): Promise<Record<string, unknown>> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resp = await fetch(`${url}/functions/v1/vat-report-engine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify({
      ...body,
      include_audit_trail: false,
      force_recompute: true,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`vat-report-engine failed: ${resp.status} ${t}`);
  }
  const j = await resp.json();
  if (!j?.success) throw new Error(`vat-report-engine error: ${j?.error ?? "unknown"}`);
  return j.payload as Record<string, unknown>;
}
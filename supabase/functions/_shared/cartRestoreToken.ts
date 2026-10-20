/**
 * MAIL-3 — ondertekende herstel-link voor een verlaten winkelmandje.
 *
 * De link in de herinneringsmail draagt NOOIT het cart_id: wie een cart_id kent, leest via
 * checkout_start de klantgegevens (adres, telefoon, btw). Het token verwijst naar de
 * automation-run (`automation_runs.id`), die via geen enkele publieke actie bruikbaar is.
 * storefront-api `cart_restore` maakt er een NIEUW mandje mee met enkel de producten.
 *
 * Vorm: `v1.<run_id>.<exp>.<sig>`
 *   exp = unix-seconden, hooguit 7 dagen na verzending en nooit na het verlopen van het mandje.
 *   sig = HMAC-SHA256 over `cart-restore:v1:<tenant_id>:<run_id>:<exp>`, base64url, 32 tekens.
 * De eigen context-prefix zorgt dat een uitschrijfhandtekening (marketingToken.ts, bericht
 * `<tenant>:<email>`) nooit als herstel-token geldt. Het token is niet eenmalig maar idempotent:
 * link-scanners (Outlook Safe Links, Gmail) openen links vooraf.
 *
 * Sleutel: `MARKETING_LINK_SECRET`, anders afgeleid van de service-role key (zelfde kanttekening
 * bij rotatie als marketingToken.ts: zonder het secret maakt een rotatie oude links ongeldig).
 */

import { sellqoStorefrontBaseUrl, type StorefrontUrlContext } from "./storefrontUrls.ts";

const enc = new TextEncoder();

/** Geldigheid van een herstel-link (beslissing Akke 20-10: 7 dagen). */
export const CART_RESTORE_TTL_SECONDS = 7 * 24 * 3600;
/** Pad van de herstelpagina in de SellQo-winkel (sellqo-storefront `winkelmandje_.herstel.tsx`). */
export const CART_RESTORE_PATH = "/winkelmandje/herstel";
/** Prefix van de session_id van een hersteld mandje; de scan sluit die mandjes uit. */
export const CART_RESTORE_SESSION_PREFIX = "restore:";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^v1\.([0-9a-f-]{36})\.(\d{1,12})\.([A-Za-z0-9_-]{32})$/;

async function hmacKey(): Promise<CryptoKey> {
  const explicit = Deno.env.get("MARKETING_LINK_SECRET");
  const base = explicit || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base) throw new Error("[cartRestoreToken] geen sleutel beschikbaar");
  const material = explicit ? base : `marketing-link:v1:${base}`;
  return await crypto.subtle.importKey("raw", enc.encode(material), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signature(tenantId: string, runId: string, exp: number): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`cart-restore:v1:${tenantId}:${runId}:${exp}`));
  return toBase64Url(sig).slice(0, 32);
}

/** Vervaldatum: min(nu + 7 dagen, verlopen van het mandje), in unix-seconden. */
export function cartRestoreExpiry(now: Date, cartExpiresAt: string | Date | null | undefined): number {
  let exp = Math.floor(now.getTime() / 1000) + CART_RESTORE_TTL_SECONDS;
  if (cartExpiresAt) {
    const t = new Date(cartExpiresAt).getTime();
    if (Number.isFinite(t)) exp = Math.min(exp, Math.floor(t / 1000));
  }
  return exp;
}

export async function signCartRestore(tenantId: string, runId: string, exp: number): Promise<string> {
  const run = String(runId).toLowerCase();
  if (!UUID.test(run)) throw new Error("[cartRestoreToken] ongeldige run-id");
  if (!Number.isInteger(exp) || exp <= 0) throw new Error("[cartRestoreToken] ongeldige vervaldatum");
  return `v1.${run}.${exp}.${await signature(tenantId, run, exp)}`;
}

export type CartRestoreVerdict =
  | { ok: true; runId: string; exp: number }
  | { ok: false; code: "RESTORE_INVALID" | "RESTORE_EXPIRED" };

/**
 * Controleert vorm, handtekening (constante tijd) en vervaldatum. Een vervalst token geeft
 * altijd RESTORE_INVALID; enkel een echt, verlopen token geeft RESTORE_EXPIRED.
 */
export async function verifyCartRestore(
  tenantId: string | null | undefined,
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<CartRestoreVerdict> {
  const invalid = { ok: false as const, code: "RESTORE_INVALID" as const };
  if (!tenantId || typeof token !== "string" || token.length > 128) return invalid;
  const m = TOKEN.exec(token.trim());
  if (!m || !UUID.test(m[1])) return invalid;
  const runId = m[1];
  const exp = Number(m[2]);
  let expected: string;
  try {
    expected = await signature(tenantId, runId, exp);
  } catch {
    return invalid;
  }
  const sig = m[3];
  if (expected.length !== sig.length) return invalid;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (mismatch !== 0) return invalid;
  if (exp * 1000 <= now.getTime()) return { ok: false, code: "RESTORE_EXPIRED" };
  return { ok: true, runId, exp };
}

/**
 * {{cart_url}} van een winkelwagenherinnering. SellQo-winkel (geen custom frontend, online of
 * eigen domein) → herstel-link. Anders exact `shopUrl` zoals vóór MAIL-3: de zes custom
 * frontends houden hun homepage-link (beslissing 6).
 */
export async function cartUrlForReminder(opts: {
  storefront: StorefrontUrlContext;
  shopUrl: string;
  tenantId: string;
  runId: string;
  cartExpiresAt: string | null | undefined;
  now?: Date;
}): Promise<string> {
  const base = sellqoStorefrontBaseUrl(opts.storefront);
  if (!base) return opts.shopUrl || "";
  const exp = cartRestoreExpiry(opts.now ?? new Date(), opts.cartExpiresAt);
  const token = await signCartRestore(opts.tenantId, opts.runId, exp);
  return `${base}${CART_RESTORE_PATH}?t=${encodeURIComponent(token)}`;
}

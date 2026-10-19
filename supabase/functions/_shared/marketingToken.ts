/**
 * MAIL-1a — ondertekende links voor uitschrijven en mailvoorkeuren.
 *
 * Tot 19 okt 2026 bevatten uitschrijflinks enkel `?email=…&tenant=…` zonder
 * controle: wie een adres en een tenant-id kende, kon iedereen uitschrijven
 * (en via email-preferences opnieuw inschrijven). Nu draagt elke link een
 * HMAC-SHA256-handtekening over (tenant, e-mail). Zonder geldige handtekening
 * doen unsubscribe en email-preferences niets.
 *
 * Sleutel: `MARKETING_LINK_SECRET` als die bestaat, anders afgeleid van de
 * service-role key (altijd aanwezig in edge functions, nooit publiek). Let op:
 * wordt de service-role key ooit geroteerd zonder `MARKETING_LINK_SECRET`, dan
 * worden oude links ongeldig. Zet het secret om dat te vermijden.
 */

const enc = new TextEncoder();

async function hmacKey(): Promise<CryptoKey> {
  const explicit = Deno.env.get("MARKETING_LINK_SECRET");
  const base = explicit || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base) throw new Error("[marketingToken] geen sleutel beschikbaar");
  const material = explicit ? base : `marketing-link:v1:${base}`;
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const normEmail = (email: string) => email.trim().toLowerCase();

/** Handtekening over (tenant, e-mail). Hoofdletters in het adres maken niet uit. */
export async function signMarketingLink(tenantId: string, email: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${tenantId}:${normEmail(email)}`));
  return toBase64Url(sig).slice(0, 32);
}

/** Vergelijkt zonder vroegtijdig af te breken. Geeft false bij elke twijfel. */
export async function verifyMarketingLink(
  tenantId: string | null | undefined,
  email: string | null | undefined,
  sig: string | null | undefined,
): Promise<boolean> {
  if (!tenantId || !email || !sig) return false;
  let expected: string;
  try {
    expected = await signMarketingLink(tenantId, email);
  } catch {
    return false;
  }
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return mismatch === 0;
}

function functionsBase(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("[marketingToken] SUPABASE_URL ontbreekt");
  return `${url}/functions/v1`;
}

/** Uitschrijflink voor in de mail én in de List-Unsubscribe-header (RFC 8058). */
export async function buildUnsubscribeUrl(tenantId: string, email: string): Promise<string> {
  const s = await signMarketingLink(tenantId, email);
  return `${functionsBase()}/unsubscribe?tenant=${encodeURIComponent(tenantId)}&email=${encodeURIComponent(normEmail(email))}&s=${s}`;
}

/** Link naar de voorkeurenpagina, met dezelfde handtekening. */
export async function buildPreferencesUrl(tenantId: string, email: string): Promise<string> {
  const s = await signMarketingLink(tenantId, email);
  return `${functionsBase()}/email-preferences?tenant=${encodeURIComponent(tenantId)}&email=${encodeURIComponent(normEmail(email))}&s=${s}`;
}

/** HTML-escaping voor alles wat uit een querystring of de database in een pagina komt. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

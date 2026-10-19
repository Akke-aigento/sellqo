/**
 * MAIL-1c — gedeelde stukjes voor de mailpagina's op sellqo.app.
 *
 * Supabase serveert HTML uit edge functions als text/plain (vastgesteld in de
 * productie-smoketest van 19 okt 2026): klanten zagen de ruwe broncode. Daarom
 * renderen unsubscribe, email-preferences en newsletter-confirm geen pagina's
 * meer. Een browser-GET krijgt een 302 naar een publieke pagina in de React-app
 * (/mail/...), en die pagina praat via JSON met dezelfde functie.
 */

import { getTenantBrand, type TenantBrand } from "./tenantEmail.ts";
import { LOGO_URL } from "./sellqoEmail.ts";

const DEFAULT_APP_URL = "https://sellqo.app";

/** Basis-URL van de app (PUBLIC_APP_URL), enkel als het een geldige https-origin is. */
export function appBaseUrl(): string {
  const raw = Deno.env.get("PUBLIC_APP_URL");
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost")) return u.origin;
    } catch { /* val terug op sellqo.app */ }
  }
  return DEFAULT_APP_URL;
}

/** 302 naar `${app}${path}?<params>`. Lege waarden worden weggelaten. */
export function redirectToApp(
  path: string,
  params: Record<string, string | null | undefined>,
  extraHeaders: Record<string, string> = {},
): Response {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const q = qs.toString();
  return new Response(null, {
    status: 302,
    headers: { ...extraHeaders, Location: `${appBaseUrl()}${path}${q ? `?${q}` : ""}`, "Cache-Control": "no-store" },
  });
}

export const isHttpUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//i.test(v.trim());

/**
 * Publieke shop-URL: eigen domein, anders geverifieerd canoniek domein, anders <slug>.sellqo.shop.
 * Zie ook storefrontUrls.ts (MAIL-2c): de productlink per winkel. Bewust apart: deze functie geeft
 * altijd een homepage-link (ook voor custom frontends via websiteUrl en ook als de winkel nog niet
 * online staat), productUrlFor geeft enkel een link die zeker bestaat, anders null.
 */
// deno-lint-ignore no-explicit-any
export async function resolveShopUrl(supabase: any, tenantId: string, brand: TenantBrand): Promise<string> {
  if (brand.websiteUrl) return brand.websiteUrl;
  try {
    const { data } = await supabase
      .from("tenant_domains").select("domain")
      .eq("tenant_id", tenantId).eq("is_active", true).eq("dns_verified", true).eq("is_canonical", true)
      .limit(1).maybeSingle();
    if (data?.domain) return `https://${data.domain}`;
  } catch (_e) { /* val terug op sellqo.shop */ }
  const slug = brand.senderSource.slug;
  return slug ? `https://${slug}.sellqo.shop` : "";
}

/** Logo van de winkel, of null als enkel het SellQo-standaardlogo beschikbaar is. */
export const shopLogo = (brand: TenantBrand): string | null =>
  isHttpUrl(brand.logoUrl) && brand.logoUrl !== LOGO_URL ? brand.logoUrl : null;

export interface ShopInfo {
  shop_name: string;
  logo_url: string | null;
  shop_url: string | null;
}

/** Naam, logo en webshop-URL voor de kop van een mailpagina. Faalt nooit. */
// deno-lint-ignore no-explicit-any
export async function getShopInfo(supabase: any, tenantId: string): Promise<ShopInfo> {
  try {
    const brand = await getTenantBrand(supabase, tenantId);
    const shopUrl = await resolveShopUrl(supabase, tenantId, brand);
    return { shop_name: brand.tenantName, logo_url: shopLogo(brand), shop_url: isHttpUrl(shopUrl) ? shopUrl : null };
  } catch (e) {
    console.error("[mailPages] shopinfo fout", e);
    return { shop_name: "", logo_url: null, shop_url: null };
  }
}

export const isJsonRequest = (req: Request) =>
  (req.headers.get("content-type") || "").toLowerCase().includes("application/json");

export const jsonResponse = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Enkel deze parameters gaan mee in een redirect naar de app. */
export function pickParams(url: URL, keys: readonly string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of keys) {
    const v = url.searchParams.get(k);
    out[k] = v && v.length <= 512 ? v : null;
  }
  return out;
}

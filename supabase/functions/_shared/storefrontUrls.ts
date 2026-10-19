/**
 * MAIL-2c — de publieke productlink van een winkel, op één plek.
 *
 * Regels (in deze volgorde, en nooit een domein raden):
 *   1. `tenants.product_url_template` is gezet (met `{slug}`, https) → die template.
 *      Zo werken de custom frontends (loveke.be/shop/{slug}, vanxcel.com/shop/{slug}, …).
 *   2. De winkel draait op het SellQo-theme (`use_custom_frontend` niet true) en heeft een domein:
 *      een actief, DNS-geverifieerd, canoniek eigen domein, of anders `<slug>.sellqo.shop` zodra de
 *      winkel online staat (`tenant_theme_settings.shop_live`). Het productpad van de SellQo-winkel
 *      is `/producten/<slug>` (sellqo-storefront `src/routes/producten.$slug.tsx`).
 *   3. Anders null: geen link. Een custom frontend zonder template (bv. Astra Sleep) krijgt dus nooit
 *      een gegokte link.
 *
 * Zie ook mailPages.ts resolveShopUrl: de homepage-link van een winkel in mails (valt altijd terug op
 * <slug>.sellqo.shop). Niet samengevoegd: die functie mag een algemene link geven, deze nooit een gok.
 *
 * Puur (geen Deno, geen netwerk) zodat ook de admin-app (src/) dit bestand kan importeren.
 * `loadStorefrontUrlContext` leest de databank via een meegegeven client.
 */

export interface StorefrontUrlContext {
  /** tenants.slug */
  slug: string | null;
  /** tenants.product_url_template, bv. https://loveke.be/shop/{slug} */
  productUrlTemplate: string | null;
  /** tenant_theme_settings.use_custom_frontend */
  useCustomFrontend: boolean;
  /** tenant_theme_settings.shop_live */
  shopLive: boolean;
  /** tenant_domains.domain (actief, dns_verified, is_canonical) */
  canonicalDomain: string | null;
}

/** Context zonder enige link: wat je gebruikt als je de winkel niet kon lezen. */
export const NO_LINK_CONTEXT: StorefrontUrlContext = {
  slug: null,
  productUrlTemplate: null,
  useCustomFrontend: true,
  shopLive: false,
  canonicalDomain: null,
};

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SHOP_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** "https://www.shop.be/" of "Shop.be" → "shop.be"-vorm; ongeldig → null. */
export function normalizeHost(raw: string | null | undefined): string | null {
  let v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  return HOSTNAME.test(v) ? v : null;
}

/** Enkel een absolute https-URL zonder spaties of aanhalingstekens, genormaliseerd door URL. */
function httpsUrl(candidate: string): string | null {
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" || !normalizeHost(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Basis-URL van de SellQo-winkel, of null (custom frontend, niet online, geen domein). */
export function sellqoStorefrontBaseUrl(ctx: StorefrontUrlContext): string | null {
  if (ctx.useCustomFrontend) return null;
  const domain = normalizeHost(ctx.canonicalDomain);
  if (domain) return `https://${domain}`;
  const slug = String(ctx.slug ?? "").trim().toLowerCase();
  if (ctx.shopLive && SHOP_SLUG.test(slug)) return `https://${slug}.sellqo.shop`;
  return null;
}

/** Publieke productpagina, of null als SellQo die niet met zekerheid kent. */
export function productUrlFor(ctx: StorefrontUrlContext, productSlug: string | null | undefined): string | null {
  const slug = String(productSlug ?? "").trim();
  if (!slug) return null;
  const tpl = String(ctx.productUrlTemplate ?? "").trim();
  if (tpl) {
    // Een template zonder {slug} of zonder https is een configuratiefout: geen link, niet raden.
    if (!tpl.includes("{slug}")) return null;
    return httpsUrl(tpl.split("{slug}").join(encodeURIComponent(slug)));
  }
  const base = sellqoStorefrontBaseUrl(ctx);
  return base ? httpsUrl(`${base}/producten/${encodeURIComponent(slug)}`) : null;
}

/** Heeft deze winkel überhaupt publieke productlinks? (voor meldingen in de editor) */
export function hasProductUrls(ctx: StorefrontUrlContext): boolean {
  return productUrlFor(ctx, "x") !== null;
}

// ── Databank ─────────────────────────────────────────────────────────

interface QueryResult {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}
interface StorefrontQuery extends PromiseLike<QueryResult> {
  select(columns: string): StorefrontQuery;
  eq(column: string, value: unknown): StorefrontQuery;
  limit(n: number): StorefrontQuery;
  maybeSingle(): PromiseLike<QueryResult>;
}
/** Het stukje van een Supabase-client dat de loader nodig heeft. */
export interface StorefrontUrlDb {
  from(table: string): StorefrontQuery;
}

/**
 * Leest de context van één winkel. Faalt nooit: lukt een query niet, dan valt het betrokken deel
 * terug op "geen link" (een custom frontend zonder template levert dan null, nooit een gok).
 */
export async function loadStorefrontUrlContext(db: StorefrontUrlDb, tenantId: string): Promise<StorefrontUrlContext> {
  try {
    const [tenant, theme, domain] = await Promise.all([
      db.from("tenants").select("slug, product_url_template").eq("id", tenantId).maybeSingle(),
      db.from("tenant_theme_settings").select("use_custom_frontend, shop_live").eq("tenant_id", tenantId).maybeSingle(),
      db.from("tenant_domains").select("domain")
        .eq("tenant_id", tenantId).eq("is_active", true).eq("dns_verified", true).eq("is_canonical", true)
        .limit(1).maybeSingle(),
    ]);
    if (tenant.error || !tenant.data) return NO_LINK_CONTEXT;
    const t = tenant.data;
    // Zonder leesbare themarij weten we niet of de winkel een eigen frontend heeft: voorzichtig.
    const th = theme.error ? null : theme.data;
    return {
      slug: typeof t.slug === "string" ? t.slug : null,
      productUrlTemplate: typeof t.product_url_template === "string" ? t.product_url_template : null,
      useCustomFrontend: theme.error ? true : th?.use_custom_frontend === true,
      shopLive: th?.shop_live === true,
      canonicalDomain: !domain.error && typeof domain.data?.domain === "string" ? domain.data.domain : null,
    };
  } catch {
    return NO_LINK_CONTEXT;
  }
}

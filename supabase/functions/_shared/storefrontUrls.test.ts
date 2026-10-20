// MAIL-2c — productlinks per winkel.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  hasProductUrls,
  loadStorefrontUrlContext,
  NO_LINK_CONTEXT,
  normalizeHost,
  productUrlFor,
  shopHomeUrlFor,
  type StorefrontUrlContext,
  type StorefrontUrlDb,
} from "./storefrontUrls.ts";

const base: StorefrontUrlContext = {
  slug: "demo-bakkerij",
  productUrlTemplate: null,
  useCustomFrontend: false,
  shopLive: true,
  canonicalDomain: null,
};

Deno.test("template wint, slug wordt gecodeerd", () => {
  const ctx = { ...base, useCustomFrontend: true, productUrlTemplate: "https://loveke.be/shop/{slug}" };
  assertEquals(productUrlFor(ctx, "rode trui"), "https://loveke.be/shop/rode%20trui");
  assertEquals(productUrlFor(ctx, 'x"><script>'), "https://loveke.be/shop/x%22%3E%3Cscript%3E");
});

Deno.test("custom frontend zonder template (Astra Sleep): nooit een link", () => {
  const ctx = { ...base, slug: "astra-sleep", useCustomFrontend: true, shopLive: false };
  assertEquals(productUrlFor(ctx, "matras"), null);
  // Ook niet met een (geverifieerd) domein: het pad van een eigen frontend kennen we niet.
  assertEquals(productUrlFor({ ...ctx, canonicalDomain: "astrasleep.be" }, "matras"), null);
  assertEquals(hasProductUrls(ctx), false);
});

Deno.test("SellQo-theme: eigen domein, anders slug.sellqo.shop als de winkel online staat", () => {
  assertEquals(productUrlFor({ ...base, canonicalDomain: "www.bakker.be" }, "brood"), "https://www.bakker.be/producten/brood");
  assertEquals(productUrlFor(base, "brood"), "https://demo-bakkerij.sellqo.shop/producten/brood");
  assertEquals(productUrlFor({ ...base, shopLive: false }, "brood"), null);
});

Deno.test("ongeldige template of domein: geen link, geen gok", () => {
  assertEquals(productUrlFor({ ...base, productUrlTemplate: "http://shop.be/p/{slug}" }, "a"), null);
  assertEquals(productUrlFor({ ...base, productUrlTemplate: "https://shop.be/p/" }, "a"), null);
  assertEquals(productUrlFor({ ...base, productUrlTemplate: "javascript:alert(1)//{slug}" }, "a"), null);
  assertEquals(productUrlFor(base, ""), null);
  assertEquals(normalizeHost("https://www.ZonaDorata.com/"), "www.zonadorata.com");
  assertEquals(normalizeHost("localhost"), null);
  assertEquals(normalizeHost('evil.be" onmouseover="x'), null);
  assertEquals(productUrlFor(NO_LINK_CONTEXT, "a"), null);
});

function fakeDb(tables: Record<string, { data: Record<string, unknown> | null; error?: { message: string } | null }>): StorefrontUrlDb {
  return {
    from(table: string) {
      const res = { data: tables[table]?.data ?? null, error: tables[table]?.error ?? null };
      const q: ReturnType<StorefrontUrlDb["from"]> = {
        select: () => q,
        eq: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve(res),
        then: (ok, bad) => Promise.resolve(res).then(ok, bad),
      };
      return q;
    },
  };
}

Deno.test("loader: leest template, theme en domein; fouten → voorzichtig", async () => {
  const ctx = await loadStorefrontUrlContext(fakeDb({
    tenants: { data: { slug: "vanxcel", product_url_template: "https://vanxcel.com/shop/{slug}" } },
    tenant_theme_settings: { data: { use_custom_frontend: true, shop_live: false } },
    tenant_domains: { data: { domain: "vanxcel.be" } },
  }), "t");
  assertEquals(productUrlFor(ctx, "lader"), "https://vanxcel.com/shop/lader");

  const noTheme = await loadStorefrontUrlContext(fakeDb({
    tenants: { data: { slug: "demo", product_url_template: null } },
    tenant_theme_settings: { data: null, error: { message: "boom" } },
    tenant_domains: { data: null },
  }), "t");
  assertEquals(noTheme.useCustomFrontend, true);
  assertEquals(productUrlFor(noTheme, "a"), null);

  const gone = await loadStorefrontUrlContext(fakeDb({ tenants: { data: null } }), "t");
  assertEquals(gone, NO_LINK_CONTEXT);
});

// MAIL-LOGO-1 — homepage-link in de kop van elke tenantmail.
const home = { customDomain: null, canonicalDomain: null, productUrlTemplate: null, useCustomFrontend: false, slug: "demo-bakkerij" };

Deno.test("shopHomeUrlFor: volgorde en nooit een sellqo.shop-gok voor een custom frontend", () => {
  assertEquals(shopHomeUrlFor({ ...home, customDomain: "https://VanXcel.com/", canonicalDomain: "vanxcel.be" }), "https://vanxcel.com");
  assertEquals(shopHomeUrlFor({ ...home, canonicalDomain: "www.bakkerij.be" }), "https://www.bakkerij.be");
  assertEquals(shopHomeUrlFor({ ...home, useCustomFrontend: true, productUrlTemplate: "https://www.zonadorata.com/product/{slug}" }), "https://www.zonadorata.com");
  assertEquals(shopHomeUrlFor({ ...home, useCustomFrontend: true }), null);
  assertEquals(shopHomeUrlFor({ ...home, useCustomFrontend: true, productUrlTemplate: "http://loveke.be/shop/{slug}" }), null);
  assertEquals(shopHomeUrlFor({ ...home, useCustomFrontend: true, productUrlTemplate: "https://loveke.be/shop/" }), null);
  assertEquals(shopHomeUrlFor(home), "https://demo-bakkerij.sellqo.shop");
  assertEquals(shopHomeUrlFor({ ...home, slug: "Bad Slug!" }), null);
  assertEquals(shopHomeUrlFor({ ...home, customDomain: "not a domain", slug: null }), null);
});

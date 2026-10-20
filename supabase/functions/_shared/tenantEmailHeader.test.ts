// MAIL-LOGO-1 — kop van de tenantmail: logo of naam, link naar de echte winkel, escaping.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  getTenantBrand,
  pickEmailLogo,
  renderTenantEmail,
  renderTenantEmailHeader,
  type TenantBrand,
} from "./tenantEmail.ts";
import { LOGO_URL } from "./sellqoEmail.ts";
import { resolveShopUrl } from "./mailPages.ts";
import { applyVariables, stripEmptyImageTokens } from "./emailContent.ts";
import { nameFromSlug } from "./tenantEmail.ts";

// ── Nep-client: antwoord per tabel (en voor tenants per select) ─────────────

type Rows = {
  tenant?: Record<string, unknown> | null;
  emailLogo?: Record<string, unknown> | null;
  emailLogoError?: boolean;
  theme?: Record<string, unknown> | null;
  themeError?: boolean;
  domain?: Record<string, unknown> | null;
};

function fakeDb(rows: Rows) {
  return {
    from(table: string) {
      let cols = "";
      const q = {
        select(c: string) { cols = c; return q; },
        eq() { return q; },
        limit() { return q; },
        maybeSingle() {
          if (table === "tenants" && cols.startsWith("email_logo_url")) {
            return Promise.resolve(rows.emailLogoError
              ? { data: null, error: { message: "column tenants.email_logo_url does not exist" } }
              : { data: rows.emailLogo ?? null, error: null });
          }
          if (table === "tenants") return Promise.resolve({ data: rows.tenant ?? null, error: null });
          if (table === "tenant_theme_settings") {
            return Promise.resolve(rows.themeError
              ? { data: null, error: { message: "boom" } }
              : { data: rows.theme ?? null, error: null });
          }
          if (table === "tenant_domains") return Promise.resolve({ data: rows.domain ?? null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    },
  };
}

const tenant = (extra: Record<string, unknown> = {}) => ({
  id: "t1", name: "Bakkerij Peeters", slug: "bakkerij-peeters", primary_color: "#8b4513", ...extra,
});

// ── pickEmailLogo ───────────────────────────────────────────────────────────

Deno.test("pickEmailLogo: geen logo → null, nooit het SellQo-logo", () => {
  assertEquals(pickEmailLogo({}), { logoUrl: null, emailLogoUrl: null });
  assertEquals(pickEmailLogo({ tenantLogo: "  ", themeLogo: "javascript:alert(1)" }), { logoUrl: null, emailLogoUrl: null });
});

Deno.test("pickEmailLogo: facturatietenant (SellQo zelf) houdt het SellQo-logo", () => {
  assertEquals(pickEmailLogo({ isBillingTenant: true }), { logoUrl: LOGO_URL, emailLogoUrl: LOGO_URL });
});

Deno.test("pickEmailLogo: variant enkel als ze bij het huidige logo hoort", () => {
  const theme = "https://x.supabase.co/storage/v1/object/public/tenant-logos/t1/logo/1.png";
  const variant = "https://x.supabase.co/storage/v1/object/public/tenant-logos/t1/email-logo-abc.png";
  assertEquals(pickEmailLogo({ themeLogo: theme, emailLogo: variant, emailLogoSource: theme }).emailLogoUrl, variant);
  // Nieuw logo geüpload zonder (geslaagde) variant: het origineel, niet de oude variant.
  assertEquals(pickEmailLogo({ themeLogo: theme, emailLogo: variant, emailLogoSource: "https://old/logo.png" }).emailLogoUrl, theme);
  // Themalogo gaat voor op het bedrijfslogo, zoals in de storefront.
  assertEquals(pickEmailLogo({ themeLogo: theme, tenantLogo: "https://t/logo.png" }).logoUrl, theme);
});

// ── Header ──────────────────────────────────────────────────────────────────

async function brandFor(rows: Rows): Promise<TenantBrand> {
  return await getTenantBrand(fakeDb(rows) as unknown as Parameters<typeof getTenantBrand>[0], "t1");
}

Deno.test("header zonder logo: winkelnaam als tekst, geen SellQo-logo, geen sellqo.app", async () => {
  const b = await brandFor({ tenant: tenant(), theme: { use_custom_frontend: false } });
  assertEquals(b.logoUrl, null);
  const h = renderTenantEmailHeader(b);
  assert(h.includes(">Bakkerij Peeters</span>"), h);
  assert(!h.includes("<img"), h);
  assert(!h.includes(LOGO_URL), h);
  assert(!h.includes("sellqo.app"), h);
  assert(h.includes('href="https://bakkerij-peeters.sellqo.shop"'), h);
  // Kopfont en primaire kleur (#8b4513 is leesbaar op wit).
  assert(h.includes("color:#8b4513"), h);
  assert(h.includes("font-family:Inter,"), h);
});

Deno.test("header zonder logo: onleesbare primaire kleur (bijna wit) → standaard tekstkleur", async () => {
  const b = await brandFor({ tenant: tenant({ primary_color: "#fafafa" }), theme: {} });
  const h = renderTenantEmailHeader(b);
  assert(h.includes("color:#1a2332"), h);
  assert(!h.includes("color:#fafafa"), h);
});

Deno.test("header met logo: e-mailvariant als die bij het logo hoort", async () => {
  const logo = "https://x.co/storage/v1/object/public/tenant-logos/t1/logo/1.png";
  const variant = "https://x.co/storage/v1/object/public/tenant-logos/t1/email-logo-0123456789abcdef.png";
  const b = await brandFor({
    tenant: tenant({ custom_domain: "bakkerijpeeters.be" }),
    theme: { logo_url: logo },
    emailLogo: { email_logo_url: variant, email_logo_source_url: logo },
  });
  const h = renderTenantEmailHeader(b);
  assert(h.includes(`<img src="${variant}"`), h);
  assert(h.includes('alt="Bakkerij Peeters"'), h);
  assert(h.includes('height="44"'), h);
  assert(h.includes('href="https://bakkerijpeeters.be"'), h);
});

Deno.test("header met logo, migratie nog niet gedraaid: origineel, rest van het merk intact", async () => {
  const logo = "https://x.co/logo.png";
  const b = await brandFor({ tenant: tenant(), theme: { logo_url: logo }, emailLogoError: true });
  assertEquals(b.tenantName, "Bakkerij Peeters");
  assertEquals(b.emailLogoUrl, logo);
});

Deno.test("escaping van de winkelnaam (tekst en alt)", async () => {
  const evil = `<script>alert("x")</script> & 'Co'`;
  const noLogo = renderTenantEmailHeader(await brandFor({ tenant: tenant({ name: evil }), theme: {} }));
  assert(!noLogo.includes("<script>"), noLogo);
  assert(noLogo.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;"), noLogo);
  const withLogo = renderTenantEmailHeader(await brandFor({ tenant: tenant({ name: evil }), theme: { logo_url: "https://x.co/l.png" } }));
  assert(withLogo.includes('alt="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;"'), withLogo);
});

Deno.test("logo-URL met aanhalingsteken wordt geweigerd (geen attribuut-injectie)", async () => {
  const b = await brandFor({ tenant: tenant(), theme: { logo_url: 'https://x.co/l.png" onerror="alert(1)' } });
  assertEquals(b.emailLogoUrl, null);
});

// ── Linkkeuze ───────────────────────────────────────────────────────────────

Deno.test("link: eigen domein > canoniek domein > custom frontend > slug.sellqo.shop", async () => {
  const own = await brandFor({ tenant: tenant({ custom_domain: "vanxcel.com" }), theme: { use_custom_frontend: true }, domain: { domain: "vanxcel.be" } });
  assertEquals(own.shopUrl, "https://vanxcel.com");
  const canon = await brandFor({ tenant: tenant(), theme: {}, domain: { domain: "www.peeters.be" } });
  assertEquals(canon.shopUrl, "https://www.peeters.be");
  // Loveke: custom frontend zonder domein in SellQo → de site uit product_url_template.
  const loveke = await brandFor({
    tenant: tenant({ slug: "loveke", product_url_template: "https://loveke.be/shop/{slug}" }),
    theme: { use_custom_frontend: true },
  });
  assertEquals(loveke.shopUrl, "https://loveke.be");
  const sellqoTheme = await brandFor({ tenant: tenant(), theme: { use_custom_frontend: false } });
  assertEquals(sellqoTheme.shopUrl, "https://bakkerij-peeters.sellqo.shop");
});

Deno.test("link: custom frontend zonder adres (Astra Sleep) → geen link, ook geen sellqo.shop", async () => {
  const b = await brandFor({ tenant: tenant({ slug: "astra-sleep" }), theme: { use_custom_frontend: true } });
  assertEquals(b.shopUrl, null);
  const h = renderTenantEmailHeader(b);
  assert(!h.includes("<a "), h);
  assertEquals(await resolveShopUrl(null, "t1", b), "");
});

Deno.test("link: themarij onleesbaar → voorzichtig, geen sellqo.shop-gok", async () => {
  const b = await brandFor({ tenant: tenant(), themeError: true });
  assertEquals(b.shopUrl, null);
});

Deno.test("platformmail (facturatietenant sellqo) blijft gelijk: SellQo-logo, link sellqo.app", async () => {
  const b = await brandFor({ tenant: tenant({ name: "SellQo", slug: "sellqo" }), theme: null });
  const h = renderTenantEmailHeader(b);
  assert(h.includes(`<img src="${LOGO_URL}"`), h);
  assert(h.includes('href="https://sellqo.app"'), h);
});

Deno.test("renderTenantEmail gebruikt de nieuwe kop", async () => {
  const b = await brandFor({ tenant: tenant(), theme: {} });
  const { html } = renderTenantEmail({ tenantBrand: b, locale: "nl", heading: "Hallo" });
  assert(html.includes(renderTenantEmailHeader(b)));
  assert(!html.includes(LOGO_URL));
});

// ── Review-fixes ────────────────────────────────────────────────────────────

Deno.test("pickEmailLogo: bron hoort bij dit logo maar geen variant (wit/HEIC) → winkelnaam", () => {
  const logo = "https://x.co/logo.heic";
  assertEquals(pickEmailLogo({ themeLogo: logo, emailLogo: null, emailLogoSource: logo }), { logoUrl: logo, emailLogoUrl: null });
});

Deno.test("lege winkelnaam: slug in leesbare vorm, nooit SellQo; niets → geen kop", async () => {
  assertEquals(nameFromSlug("bakkerij-peeters"), "Bakkerij Peeters");
  assertEquals(nameFromSlug("<x>"), "");
  const b = await brandFor({ tenant: tenant({ name: "  " }), theme: {} });
  assertEquals(b.tenantName, "Bakkerij Peeters");
  assert(!renderTenantEmailHeader(b).includes("SellQo"));
  const leeg = await brandFor({ tenant: null, theme: {} });
  assertEquals(leeg.tenantName, "");
  assertEquals(renderTenantEmailHeader(leeg), "");
  const platform = await brandFor({ tenant: tenant({ name: "", slug: "sellqo" }), theme: null });
  assertEquals(platform.tenantName, "SellQo");
});

Deno.test("lege logo-variabele: <img> verdwijnt i.p.v. <img src=\"\">", () => {
  const html = `<p>a</p><img src="{{tenant_logo_url}}" alt="x" style="height:44px"><img src='{{ LOGO_URL }}'/><img src="https://x.co/a.png">`;
  assertEquals(applyVariables(html, { tenant_logo_url: "" }), `<p>a</p><img src="https://x.co/a.png">`);
  assertEquals(
    applyVariables(`<img src="{{tenant_logo_url}}">`, { tenant_logo_url: "https://x.co/l.png" }),
    `<img src="https://x.co/l.png">`,
  );
  const values: Record<string, string> = { "{{LOGO_URL}}": "" };
  assertEquals(stripEmptyImageTokens(`x<img src="{{LOGO_URL}}">y`, (k) => values[`{{${k}}}`]), "xy");
  assertEquals(stripEmptyImageTokens(`<img src="{{LOGO_URL}}">`, () => "https://x.co/l.png"), `<img src="{{LOGO_URL}}">`);
});

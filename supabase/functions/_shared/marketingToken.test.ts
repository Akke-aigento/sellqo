// MAIL-1a — ondertekende uitschrijf- en voorkeurenlinks.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildUnsubscribePageUrl, buildUnsubscribeUrl, escapeHtml, signMarketingLink, verifyMarketingLink } from "./marketingToken.ts";

Deno.env.set("MARKETING_LINK_SECRET", "test-secret");
Deno.env.set("SUPABASE_URL", "https://x.supabase.co");
const T = "11111111-1111-1111-1111-111111111111";

Deno.test("handtekening klopt, ongeacht hoofdletters in het adres", async () => {
  const s = await signMarketingLink(T, "Jan@Voorbeeld.be");
  assert(await verifyMarketingLink(T, "jan@voorbeeld.be", s));
});

Deno.test("ander adres, andere winkel of geen handtekening: geweigerd", async () => {
  const s = await signMarketingLink(T, "jan@voorbeeld.be");
  assertFalse(await verifyMarketingLink(T, "piet@voorbeeld.be", s));
  assertFalse(await verifyMarketingLink("22222222-2222-2222-2222-222222222222", "jan@voorbeeld.be", s));
  assertFalse(await verifyMarketingLink(T, "jan@voorbeeld.be", null));
  assertFalse(await verifyMarketingLink(T, "jan@voorbeeld.be", s.slice(0, -1) + (s.endsWith("A") ? "B" : "A")));
});

Deno.test("uitschrijflink draagt tenant, adres en handtekening", async () => {
  const url = new URL(await buildUnsubscribeUrl(T, "Jan@Voorbeeld.be"));
  assertEquals(url.pathname, "/functions/v1/unsubscribe");
  assertEquals(url.searchParams.get("email"), "jan@voorbeeld.be");
  assert(await verifyMarketingLink(url.searchParams.get("tenant"), url.searchParams.get("email"), url.searchParams.get("s")));
});

Deno.test("escapeHtml", () => {
  assertEquals(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

Deno.test("afmeldpagina-link (MAIL-2a): sellqo.app, geldige handtekening, campagne en taal", async () => {
  Deno.env.delete("PUBLIC_APP_URL");
  const url = new URL(await buildUnsubscribePageUrl(T, "Jan@Voorbeeld.be", { campaignId: "c1", lang: "fr" }));
  assertEquals(url.origin, "https://sellqo.app");
  assertEquals(url.pathname, "/mail/afmelden");
  assertEquals(url.searchParams.get("email"), "jan@voorbeeld.be");
  assertEquals(url.searchParams.get("campaign"), "c1");
  assertEquals(url.searchParams.get("lang"), "fr");
  assert(await verifyMarketingLink(url.searchParams.get("tenant"), url.searchParams.get("email"), url.searchParams.get("s")));
});

Deno.test("afmeldpagina-link: PUBLIC_APP_URL enkel als geldige origin", async () => {
  Deno.env.set("PUBLIC_APP_URL", "https://staging.sellqo.app/pad?x=1");
  assertEquals(new URL(await buildUnsubscribePageUrl(T, "a@b.be")).origin, "https://staging.sellqo.app");
  Deno.env.set("PUBLIC_APP_URL", "javascript:alert(1)");
  assertEquals(new URL(await buildUnsubscribePageUrl(T, "a@b.be", { lang: "x<" })).origin, "https://sellqo.app");
  assertFalse(new URL(await buildUnsubscribePageUrl(T, "a@b.be", { lang: "x<" })).searchParams.has("lang"));
  Deno.env.delete("PUBLIC_APP_URL");
});

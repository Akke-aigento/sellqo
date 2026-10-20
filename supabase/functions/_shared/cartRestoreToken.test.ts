// MAIL-3 — ondertekende herstel-link voor een verlaten winkelmandje.
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  CART_RESTORE_TTL_SECONDS,
  cartRestoreExpiry,
  cartUrlForReminder,
  signCartRestore,
  verifyCartRestore,
} from "./cartRestoreToken.ts";
import { signMarketingLink } from "./marketingToken.ts";
import type { StorefrontUrlContext } from "./storefrontUrls.ts";

Deno.env.set("MARKETING_LINK_SECRET", "test-secret");
const T = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const RUN = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-20T10:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

Deno.test("geldig token: run-id en vervaldatum terug", async () => {
  const tok = await signCartRestore(T, RUN, nowSec + 3600);
  assert(/^v1\.[0-9a-f-]{36}\.\d+\.[A-Za-z0-9_-]{32}$/.test(tok));
  assertEquals(await verifyCartRestore(T, tok, NOW), { ok: true, runId: RUN, exp: nowSec + 3600 });
});

Deno.test("vervalst token: andere handtekening, andere run, opgerekte vervaldatum, rommel", async () => {
  const tok = await signCartRestore(T, RUN, nowSec + 3600);
  const [, , exp, sig] = tok.split(".");
  const flipped = tok.slice(0, -1) + (tok.endsWith("A") ? "B" : "A");
  const invalid = { ok: false, code: "RESTORE_INVALID" };
  assertEquals(await verifyCartRestore(T, flipped, NOW), invalid);
  assertEquals(await verifyCartRestore(T, `v1.44444444-4444-4444-8444-444444444444.${exp}.${sig}`, NOW), invalid);
  assertEquals(await verifyCartRestore(T, `v1.${RUN}.${Number(exp) + 86400}.${sig}`, NOW), invalid);
  assertEquals(await verifyCartRestore(T, `v2.${RUN}.${exp}.${sig}`, NOW), invalid);
  assertEquals(await verifyCartRestore(T, "", NOW), invalid);
  assertEquals(await verifyCartRestore(T, null, NOW), invalid);
  assertEquals(await verifyCartRestore(T, "x".repeat(500), NOW), invalid);
});

Deno.test("andere winkel: geweigerd", async () => {
  const tok = await signCartRestore(T, RUN, nowSec + 3600);
  assertEquals(await verifyCartRestore(T2, tok, NOW), { ok: false, code: "RESTORE_INVALID" });
  assertEquals(await verifyCartRestore(null, tok, NOW), { ok: false, code: "RESTORE_INVALID" });
});

Deno.test("verlopen: RESTORE_EXPIRED, maar een vervalst verlopen token blijft RESTORE_INVALID", async () => {
  const tok = await signCartRestore(T, RUN, nowSec - 1);
  assertEquals(await verifyCartRestore(T, tok, NOW), { ok: false, code: "RESTORE_EXPIRED" });
  assertEquals(await verifyCartRestore(T, await signCartRestore(T, RUN, nowSec), NOW), { ok: false, code: "RESTORE_EXPIRED" });
  const forged = tok.slice(0, -1) + (tok.endsWith("A") ? "B" : "A");
  assertEquals(await verifyCartRestore(T, forged, NOW), { ok: false, code: "RESTORE_INVALID" });
});

Deno.test("een uitschrijfhandtekening geldt nooit als herstel-token", async () => {
  const s = await signMarketingLink(T, `${RUN}:${nowSec + 3600}`);
  assertEquals(await verifyCartRestore(T, `v1.${RUN}.${nowSec + 3600}.${s}`, NOW), { ok: false, code: "RESTORE_INVALID" });
});

Deno.test("andere sleutel: oude links ongeldig", async () => {
  const tok = await signCartRestore(T, RUN, nowSec + 3600);
  Deno.env.set("MARKETING_LINK_SECRET", "andere-sleutel");
  try {
    assertEquals(await verifyCartRestore(T, tok, NOW), { ok: false, code: "RESTORE_INVALID" });
  } finally {
    Deno.env.set("MARKETING_LINK_SECRET", "test-secret");
  }
});

Deno.test("signeren weigert een ongeldige run-id of vervaldatum", async () => {
  await assertRejects(() => signCartRestore(T, "geen-uuid", nowSec + 10));
  await assertRejects(() => signCartRestore(T, RUN, 0));
});

Deno.test("vervaldatum: 7 dagen, nooit na het mandje", () => {
  assertEquals(cartRestoreExpiry(NOW, null), nowSec + CART_RESTORE_TTL_SECONDS);
  assertEquals(cartRestoreExpiry(NOW, "2999-01-01T00:00:00Z"), nowSec + CART_RESTORE_TTL_SECONDS);
  assertEquals(cartRestoreExpiry(NOW, "2026-10-21T10:00:00Z"), nowSec + 86400);
  assertEquals(cartRestoreExpiry(NOW, "onzin"), nowSec + CART_RESTORE_TTL_SECONDS);
});

const ctx = (over: Partial<StorefrontUrlContext>): StorefrontUrlContext => ({
  slug: "bakkerij", productUrlTemplate: null, useCustomFrontend: false, shopLive: true, canonicalDomain: null, ...over,
});

Deno.test("{{cart_url}}: SellQo-winkel krijgt de herstel-link met een geldig token", async () => {
  const url = new URL(await cartUrlForReminder({
    storefront: ctx({}), shopUrl: "https://bakkerij.sellqo.shop", tenantId: T, runId: RUN, cartExpiresAt: null, now: NOW,
  }));
  assertEquals(url.origin, "https://bakkerij.sellqo.shop");
  assertEquals(url.pathname, "/winkelmandje/herstel");
  const v = await verifyCartRestore(T, url.searchParams.get("t"), NOW);
  assertEquals(v, { ok: true, runId: RUN, exp: nowSec + CART_RESTORE_TTL_SECONDS });
  const own = await cartUrlForReminder({
    storefront: ctx({ canonicalDomain: "www.bakker.be" }), shopUrl: "x", tenantId: T, runId: RUN, cartExpiresAt: null, now: NOW,
  });
  assert(own.startsWith("https://www.bakker.be/winkelmandje/herstel?t=v1."));
});

Deno.test("{{cart_url}}: custom frontend en winkel niet online houden exact de winkel-URL", async () => {
  for (const sf of [
    ctx({ useCustomFrontend: true, productUrlTemplate: "https://loveke.be/shop/{slug}", canonicalDomain: "loveke.be" }),
    ctx({ useCustomFrontend: true }),
    ctx({ shopLive: false }),
  ]) {
    assertEquals(
      await cartUrlForReminder({ storefront: sf, shopUrl: "https://loveke.be", tenantId: T, runId: RUN, cartExpiresAt: null, now: NOW }),
      "https://loveke.be",
    );
  }
  assertEquals(
    await cartUrlForReminder({ storefront: ctx({ useCustomFrontend: true }), shopUrl: "", tenantId: T, runId: RUN, cartExpiresAt: null }),
    "",
  );
});

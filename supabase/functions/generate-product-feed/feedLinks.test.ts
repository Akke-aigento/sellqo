// FEED-LINK-1 — productlinks in de feed: nooit een gegokt domein, geen dode links.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import type { StorefrontUrlContext } from "../_shared/storefrontUrls.ts";
import { feedHomeUrl, feedLinkProblem, withFeedLinks } from "./feedLinks.ts";

const sellqoLive: StorefrontUrlContext = {
  slug: "demo-webshop",
  productUrlTemplate: null,
  useCustomFrontend: false,
  shopLive: true,
  canonicalDomain: null,
};
const vanxcel: StorefrontUrlContext = {
  slug: "vanxcel",
  productUrlTemplate: "https://vanxcel.com/shop/{slug}",
  useCustomFrontend: true,
  shopLive: false,
  canonicalDomain: "vanxcel.be",
};
const products = [{ slug: "jas" }, { slug: "" }, { slug: null }, { slug: "zak & co" }];

Deno.test("SellQo-theme online: <slug>.sellqo.shop/producten/<slug>, nooit sellqo.app/shop", () => {
  const { items, skipped } = withFeedLinks(sellqoLive, products);
  assertEquals(items.map((i) => i.link), [
    "https://demo-webshop.sellqo.shop/producten/jas",
    "https://demo-webshop.sellqo.shop/producten/zak%20%26%20co",
  ]);
  assertEquals(skipped, 2);
  assertEquals(feedHomeUrl(sellqoLive), "https://demo-webshop.sellqo.shop");
  assertEquals(feedLinkProblem(sellqoLive), null);
});

Deno.test("SellQo-theme met geverifieerd canoniek domein: dat domein, ook als de winkel niet live staat", () => {
  const ctx = { ...sellqoLive, shopLive: false, canonicalDomain: "www.bakker.be" };
  assertEquals(withFeedLinks(ctx, [{ slug: "brood" }]).items[0].link, "https://www.bakker.be/producten/brood");
  assertEquals(feedHomeUrl(ctx), "https://www.bakker.be");
});

Deno.test("SellQo-theme niet online en geen domein: geen feed (422), geen gok", () => {
  const ctx = { ...sellqoLive, shopLive: false };
  assertEquals(feedLinkProblem(ctx), "shop_not_live");
  assertEquals(feedHomeUrl(ctx), null);
  assertEquals(withFeedLinks(ctx, [{ slug: "jas" }]).items.length, 0);
});

Deno.test("custom frontend met template: template wint, ook boven het canonieke domein (ongewijzigd)", () => {
  const { items } = withFeedLinks(vanxcel, [{ slug: "solar-panel" }]);
  assertEquals(items[0].link, "https://vanxcel.com/shop/solar-panel");
  assertEquals(feedHomeUrl(vanxcel), "https://vanxcel.com");
  assertEquals(feedLinkProblem(vanxcel), null);
});

Deno.test("custom frontend zonder template of met kapotte template: 422 met reden", () => {
  assertEquals(feedLinkProblem({ ...vanxcel, productUrlTemplate: null }), "custom_frontend_no_template");
  assertEquals(feedLinkProblem({ ...vanxcel, productUrlTemplate: "http://vanxcel.com/shop/{slug}" }), "invalid_template");
  assertEquals(feedLinkProblem({ ...vanxcel, productUrlTemplate: "https://vanxcel.com/shop/" }), "invalid_template");
  assertEquals(feedHomeUrl({ ...vanxcel, productUrlTemplate: "https://vanxcel.com/shop/" }), null);
});

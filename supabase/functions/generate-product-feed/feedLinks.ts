/**
 * FEED-LINK-1 — welke link een product in de feed krijgt, en of het er dan nog in hoort.
 *
 * De link komt uitsluitend uit `_shared/storefrontUrls.ts` (MAIL-2c): template van een custom
 * frontend, anders de SellQo-winkel op het canonieke domein of `<slug>.sellqo.shop` (enkel als de
 * winkel online staat), pad `/producten/<slug>`. Nooit een gegokt domein.
 *
 * Google, Meta en Pinterest eisen een link per product. Een product zonder werkende link hoort dus
 * niet in de feed: het valt eruit en wordt geteld (header + log), in plaats van met een lege of
 * dode link afgekeurd te worden. Kent de winkel helemaal geen productlinks, dan geeft de functie
 * 422 met de reden, zoals SELLQO-FEED-1 al deed voor een custom frontend zonder template.
 *
 * Puur (geen Deno, geen netwerk), zodat het los te testen is.
 */
import { productUrlFor, sellqoStorefrontBaseUrl, type StorefrontUrlContext } from "../_shared/storefrontUrls.ts";

export type FeedLinkProblem = "custom_frontend_no_template" | "invalid_template" | "shop_not_live";

const PROBLEM_DETAIL: Record<FeedLinkProblem, string> = {
  custom_frontend_no_template:
    "This shop runs on its own website. Set tenants.product_url_template (e.g. https://yourshop.com/shop/{slug}) so the feed can link to the right product pages.",
  invalid_template:
    "tenants.product_url_template must be an https URL containing {slug} (e.g. https://yourshop.com/shop/{slug}).",
  shop_not_live:
    "The SellQo shop is not online yet and has no verified domain, so its product pages cannot be opened. Put the shop online (Webshop > Open shop) or connect a domain.",
};

/** null als de winkel productlinks heeft; anders waarom niet. */
export function feedLinkProblem(ctx: StorefrontUrlContext): FeedLinkProblem | null {
  if (productUrlFor(ctx, "x") !== null) return null;
  if (String(ctx.productUrlTemplate ?? "").trim()) return "invalid_template";
  if (ctx.useCustomFrontend) return "custom_frontend_no_template";
  return "shop_not_live";
}

export function feedLinkProblemDetail(problem: FeedLinkProblem): string {
  return PROBLEM_DETAIL[problem];
}

/** De homepage van de winkel voor `<channel><link>`; null als er geen is. */
export function feedHomeUrl(ctx: StorefrontUrlContext): string | null {
  if (String(ctx.productUrlTemplate ?? "").trim()) {
    const sample = productUrlFor(ctx, "x");
    if (!sample) return null;
    try {
      return new URL(sample).origin;
    } catch {
      return null;
    }
  }
  return sellqoStorefrontBaseUrl(ctx);
}

/** Producten mét link; wie geen link krijgt, valt eruit en wordt geteld. */
export function withFeedLinks<P extends { slug: string | null }>(
  ctx: StorefrontUrlContext,
  products: P[],
): { items: Array<P & { link: string }>; skipped: number } {
  const items: Array<P & { link: string }> = [];
  let skipped = 0;
  for (const p of products) {
    const link = productUrlFor(ctx, p.slug);
    if (link) items.push({ ...p, link });
    else skipped++;
  }
  return { items, skipped };
}

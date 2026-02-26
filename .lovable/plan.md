

## Plan: Add RESTful URL Routing to Storefront API

The existing edge function (1547 lines) uses a POST-body `action` approach. All handler functions already exist. The task is to add a RESTful URL routing layer on top, with API key validation and module checks, while keeping the existing POST approach as fallback.

### Changes to `supabase/functions/storefront-api/index.ts`

**1. Update CORS headers** (line 6)
Add `x-tenant-id, x-api-key, accept-language` to `Access-Control-Allow-Headers`.

**2. Add helper functions** (after line 8, before types)
- `jsonResponse(data, status, cacheControl)` — standardized JSON response with CORS
- `errorResponse(error, status, code)` — error wrapper
- `validateApiKey(supabase, tenantId, apiKey)` — SHA-256 hash the provided key, compare against `tenant_theme_settings.custom_frontend_config.api_key_hash`
- `isModuleEnabled(config, module)` — check if a module is enabled in `custom_frontend_config`

**3. Add RESTful router in main handler** (replace lines 1478-1547)

The new `serve()` block:
1. Handle OPTIONS (unchanged)
2. Parse URL path: strip `/functions/v1/storefront-api/` prefix, extract `resource`, `resourceId`, `subResource`
3. Read headers: `X-Tenant-ID`, `X-API-Key`, `Accept-Language`
4. **If** request has a JSON body with `action` field AND no path segments → fall through to existing POST-body switch (backward compatibility)
5. **Else** (RESTful mode):
   - Resolve tenant from `X-Tenant-ID` (lookup `tenants` table by slug or id)
   - Validate API key against stored hash
   - Load `custom_frontend_config` from `tenant_theme_settings`
   - Check module enabled for the requested resource
   - Route based on `resource` + HTTP method:

| Method | Path | Handler | Module |
|--------|------|---------|--------|
| GET | `/products` | `getProducts()` | products |
| GET | `/products/:slug` | `getProduct()` | products |
| GET | `/products/:slug/related` | uses `getProduct` related logic | products |
| GET | `/products/:slug/reviews` | `getReviews({product_id})` after slug→id lookup | reviews |
| GET | `/collections` | `getCategories()` | collections |
| GET | `/collections/:slug` | `getCategories()` filtered | collections |
| GET | `/collections/:slug/products` | `getProducts({category_slug})` | collections |
| GET | `/categories` | `getCategories()` | collections |
| POST | `/cart` | `cartCreate()` | cart |
| GET | `/cart/:id` | `cartGet()` | cart |
| POST | `/cart/:id/items` | `cartAddItem()` | cart |
| PUT | `/cart/:id/items/:itemId` | `cartUpdateItem()` | cart |
| DELETE | `/cart/:id/items/:itemId` | `cartRemoveItem()` | cart |
| POST | `/cart/:id/discount` | `cartApplyDiscount()` | cart |
| DELETE | `/cart/:id/discount` | `cartRemoveDiscount()` | cart |
| POST | `/checkout` | `checkoutPlaceOrder()` | checkout |
| GET | `/gift-cards` | stub returning gift card denominations | gift_cards |
| POST | `/gift-cards/balance` | gift card balance check | gift_cards |
| GET | `/pages` | `getPages()` | pages |
| GET | `/pages/:slug` | `getPages({slug})` | pages |
| GET | `/navigation` | builds nav from categories + pages | navigation |
| GET | `/reviews` | `getReviews()` | reviews |
| GET | `/reviews/summary` | reviews summary only | reviews |
| POST | `/newsletter/subscribe` | `newsletterSubscribe()` | newsletter |
| GET | `/settings` | `getConfig()` | — |
| GET | `/settings/social` | social links from tenants | social_media |
| GET | `/settings/trust` | trust config from theme settings | trust_compliance |
| GET | `/settings/conversion` | conversion config | conversion_boosters |
| GET | `/settings/checkout` | checkout config | checkout |
| GET | `/settings/languages` | languages from domains | multilingual |
| GET | `/search` | `searchProducts()` | — |
| GET | `/shipping` | `getShippingMethods()` | — |

**4. Add missing handler functions**

- `getNavigation(supabase, tenantId, locale)` — build main menu from categories, footer from pages + legal pages, announcement bar from theme settings. Already partially exists in the user's pasted code but not in the current file.
- `getSettingsSocial/Trust/Conversion/Checkout/Languages` — sub-endpoint handlers extracting specific config sections.
- `getProductReviews(supabase, tenantId, slug)` — reviews for a specific product by slug.
- `getRelatedProducts(supabase, tenantId, slug, limit, locale)` — related products endpoint.

**5. Body parsing for RESTful POST/PUT**

For POST/PUT requests in RESTful mode, parse JSON body and merge with URL params. Extract `session_id` from body for cart creation, `product_id`/`variant_id`/`quantity` for cart item addition, etc.

**6. Query parameter extraction**

For GET requests, parse `url.searchParams` into the params object that existing handlers expect (page, per_page, sort, search, collection, category, q, limit, etc.).

### What stays unchanged

All existing handler functions (getProducts, getProduct, getCategories, getPages, cartCreate, cartAddItem, etc.) remain exactly as they are. The POST-body action switch also remains as a fallback for the existing SellQo storefront that uses it.

### Summary

One file changed: `supabase/functions/storefront-api/index.ts`. No new files, no database changes. Adds ~250 lines for the router, API key validation, module checks, and missing handlers. Preserves all 1547 existing lines.


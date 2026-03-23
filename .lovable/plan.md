

## Volledige SellQo Storefront Integration Prompt — Audit & Aanvullingen

Na grondige analyse van de volledige `storefront-api` (2339 regels), `storefront-resolve`, en de routing-architectuur, zijn dit de **ontbrekende onderdelen** in het huidige document:

### Wat ontbreekt

**1. `storefront-resolve` — de bootstrap-stap**
Het document noemt het niet expliciet. Dit is de EERSTE call die elke custom frontend moet doen bij page load. Response bevat: `tenant_id`, `tenant_slug`, `locale`, `storefront_api_url`, `all_domains` (voor hreflang), `currency`, `country`, `logo_url`. Geen API key nodig — publiek endpoint.

**2. Volledige API endpoint tabel is incompleet**
Ontbrekende endpoints:
- `GET /collections` + `GET /collections/{slug}` + `GET /collections/{slug}/products`
- `GET /categories`
- `GET /products/{slug}/related?limit=4`
- `GET /products/{slug}/reviews`
- `GET /reviews` + `GET /reviews/summary`
- `GET /search?q=&autocomplete=true`
- `GET /navigation` — geeft main menu, footer menu, legal menu, announcement bar
- `GET /pages` + `GET /pages/{slug}`
- `GET /gift-cards` + `POST /gift-cards/balance`
- `GET /settings` (full config) + sub-endpoints: `/settings/social`, `/settings/trust`, `/settings/conversion`, `/settings/checkout`, `/settings/languages`
- `GET /legal` + `GET /legal/{type}` (privacy, terms, refund, shipping, cookie, etc.)
- `POST /contact` — contactformulier
- `POST /newsletter/subscribe`
- `GET /shipping` — verzendmethoden
- `POST /checkout` — twee flows: simpel (cart_id + success_url → hosted checkout URL) en volledig (place order direct)
- Checkout sub-actions via legacy POST: `checkout_start`, `checkout_set_addresses`, `checkout_get_shipping_options`, `checkout_get_payment_methods`, `checkout_place_order`, `checkout_get_confirmation`

**3. Locale/i18n header**
De API leest `Accept-Language` header voor vertaling. Frontend moet dit meesturen op basis van resolved locale.

**4. Promotions engine**
`POST /` met action `calculate_promotions` — volume discounts, BOGO, bundles, automatic discounts, gift promotions, customer group discounts, discount stacking rules. Frontend moet cart items meesturen voor server-side berekening.

**5. Cart response structuur — veel meer velden**
Response bevat: `id`, `session_id`, `currency`, `discount_code`, `items[]` (met `product`, `variant`, `line_total`, `product_type`, `gift_card_metadata`), `item_count`, `subtotal`, `discount_amount`, `discount_info`, `total`, `expires_at`.

**6. Checkout flow details**
- Simpele flow: `POST /checkout` met `{ cart_id, success_url, cancel_url }` → krijgt `checkout_url` terug (hosted op SellQo)
- Volledige flow: `POST /checkout` met `{ cart_id, shipping_address, billing_address, email, phone, shipping_method_id, payment_method, customer_note }` → creëert order direct
- Payment methods: `stripe` of `bank_transfer`
- Gift card orders: geen shipping nodig
- Order confirmation: `GET` via legacy action `checkout_get_confirmation` met `order_id`

**7. Gift cards**
- Cart add item voor gift cards: `{ product_id, quantity, amount, gift_card_metadata: { recipient_name, recipient_email, personal_message, design_id } }`
- Gift cards worden nooit gemerged in cart (altijd unieke items)

**8. Service points (verzendpunten)**
`POST` met action `get_service_points` — vereist `postal_code`, `country`, optioneel `carrier`, `house_number`. Werkt met Sendcloud en MyParcel integraties.

**9. SEO + Sitemap endpoints**
- `get_seo` — meta tags, canonical URL, hreflang per entity
- `get_sitemap_data` — alle slugs voor producten, categorieën, pagina's + domain mapping

**10. Module check systeem**
De API kan modules aan/uitzetten per tenant via `custom_frontend_config`. Frontend krijgt `403 MODULE_DISABLED` als een uitgeschakelde module wordt aangesproken.

**11. Dual routing: REST vs Legacy POST**
De API ondersteunt TWEE routeringsmethoden:
- **RESTful** (vereist `X-Tenant-ID` + `X-API-Key` headers): `/products`, `/cart/{id}/items`, etc.
- **Legacy POST** (body met `action` + `tenant_id`): backward compatible, geen API key nodig voor resolve_domain

De proxy moet beide ondersteunen.

### Plan

Ik schrijf het document volledig opnieuw naar `/mnt/documents/sellqo-storefront-integration-prompt.md` met:
1. Bootstrap flow (`storefront-resolve` → tenant context ophalen)
2. Proxy specificatie (beide routing modes)
3. Client met locale header support
4. Volledige type definities (incl. variant options, gift cards, promotions, navigation, settings)
5. Normalizer met ALLE veldmappings uit de echte API
6. Compleet endpoint overzicht (30+ endpoints)
7. React Query hooks (products, collections, cart, checkout, navigation, settings, legal, search)
8. CartContext met server-side cart sync
9. Checkout flow (simpel + volledig)
10. SEO/i18n helpers
11. Standaard pagina's en componenten

Dit wordt het definitieve "one-prompt SDK" document.

### Technisch

Alleen een document-export naar `/mnt/documents/`. Geen codewijzigingen in het SellQo-project.


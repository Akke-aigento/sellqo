# H4e — Route Coverage Scan

_Gegenereerd: 2026-10-20T23:30:47.221Z_

| Route | Guard | Notes |
|---|---|---|
| `*` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `/admin` | (geen) | Wrapper voor sub-routes; auth-check op layout-niveau |
| `ads` | requireRead="ads" | ✅ |
| `ads/ai` | requireRead="ads" | ✅ |
| `ads/bolcom` | requireRead="ads" | ✅ |
| `ads/bolcom/campaigns/:id` | requireRead="ads" | ✅ |
| `ads/bolcom/keywords` | requireRead="ads" | ✅ |
| `ads/bolcom/search-terms` | requireRead="ads" | ✅ |
| `ads/products` | requireRead="ads" | ✅ |
| `ai-center` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `analytics` | requireRead="reports_analytics" | ✅ |
| `badges` | (geen) | Badges-pagina open voor alle auth-users |
| `bestellen` | requireRead="orders" | ✅ |
| `billing` | requireRead="platform_billing" | ✅ |
| `categories` | (geen) | Categorieën open voor alle auth-users (read on products) |
| `checkin` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `connect` | requireRead="integrations" | ✅ |
| `connect/:connectionId` | requireRead="integrations" | ✅ |
| `connect/conflicts` | requireRead="integrations" | ✅ |
| `customers` | requireRead="customers" | ✅ |
| `customers/:customerId` | requireRead="customers" | ✅ |
| `events` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `events/:eventId` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `events/bundles` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `events/new` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `events/tokens` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `events/venues` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `events/venues/:venueId` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `fulfillment` | requireRead="orders" | ✅ |
| `help` | (geen) | Help-pagina open voor alle auth-users |
| `import` | requireRead="integrations" | ✅ |
| `invoices` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `invoices/:id` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `keuken` | requireRead="orders" | ✅ |
| `marketing` | requireRead="marketing" | ✅ |
| `marketing/ai` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `marketing/ai-center` | requireRead="ai_coach" | ✅ |
| `marketing/automations` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `marketing/campaigns/:id` | requireRead="marketing" | ✅ |
| `marketing/media` | requireRead="marketing" | ✅ |
| `marketing/seo` | requireRead="seo" | ✅ |
| `marketing/social` | requireRead="marketing" | ✅ |
| `marketing/translations` | requireRead="cms" | ✅ |
| `messages` | requireRead="inbox" | ✅ |
| `notifications` | requireRead="profile" | ✅ |
| `orders` | requireRead="orders" | ✅ |
| `orders/:id` | requireRead="orders" | ✅ |
| `orders/discounts` | requireRead="discount_codes" | ✅ |
| `orders/invoices` | requireRead="invoices" | ✅ |
| `orders/quotes` | (geen) | OK — bewust ongated |
| `orders/quotes/:id` | (geen) | OK — bewust ongated |
| `orders/quotes/:id/edit` | (geen) | OK — bewust ongated |
| `orders/quotes/new` | (geen) | OK — bewust ongated |
| `orders/subscriptions` | (geen) | OK — bewust ongated |
| `payments` | requireRead="payments" | ✅ |
| `payouts` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `platform` | (geen) | Platform-admin only — afgedekt via AdminLayout role-check |
| `platform/billing` | (geen) | OK — bewust ongated |
| `platform/blog` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `platform/changelog` | (geen) | OK — bewust ongated |
| `platform/coupons` | (geen) | OK — bewust ongated |
| `platform/dashboard` | (geen) | OK — bewust ongated |
| `platform/docs` | (geen) | OK — bewust ongated |
| `platform/feedback` | (geen) | OK — bewust ongated |
| `platform/field-mappings` | (geen) | OK — bewust ongated |
| `platform/health` | (geen) | OK — bewust ongated |
| `platform/legal` | (geen) | OK — bewust ongated |
| `platform/payments` | (geen) | OK — bewust ongated |
| `platform/support` | (geen) | OK — bewust ongated |
| `platform/tenants/:tenantId` | (geen) | OK — bewust ongated |
| `pos` | requireRead="pos" | ✅ |
| `pos/:terminalId` | (geen) | OK — bewust ongated |
| `pos/terminals/:terminalId` | (geen) | OK — bewust ongated |
| `products` | requireRead="products" | ✅ |
| `products/:id` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `products/:id/edit` | requireRead="products" | ✅ |
| `products/new` | requireWrite="products" | ✅ |
| `promotions` | requireRead="discount_codes" | ✅ |
| `promotions/auto` | requireRead="discount_codes" | ✅ |
| `promotions/bogo` | requireRead="discount_codes" | ✅ |
| `promotions/bundles` | requireRead="discount_codes" | ✅ |
| `promotions/customer-groups` | requireRead="customers" | ✅ |
| `promotions/gift-cards` | requireRead="discount_codes" | ✅ |
| `promotions/gifts` | requireRead="discount_codes" | ✅ |
| `promotions/loyalty` | requireRead="loyalty" | ✅ |
| `promotions/stacking` | requireRead="discount_codes" | ✅ |
| `promotions/volume` | requireRead="volume_discounts" | ✅ |
| `purchase-orders` | requireRead="suppliers" | ✅ |
| `quotes` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `quotes/:id` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `reports` | requireRead="reports_financial" | ✅ |
| `reports/stock` | requireRead="products" | ✅ |
| `returns` | requireRead="returns" | ✅ |
| `returns/:id` | requireRead="returns" | ✅ |
| `settings` | requireRead="profile" | ✅ |
| `settings/:section` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `shipping` | (geen) | Shipping settings — gating via subpages |
| `storefront` | requireRead="themes" | ✅ |
| `storefront/aanpassen` | requireRead="themes" | ✅ |
| `subscriptions` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `subscriptions/:id` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `supplier-documents` | requireRead="suppliers" | ✅ |
| `suppliers` | requireRead="suppliers" | ✅ |

## Samenvatting

- **Totaal admin-routes:** 103
- **Met RouteGuard:** 56
- **Zonder guard (bewust open):** 25
- **Zonder guard — ⚠️ controle nodig:** 22

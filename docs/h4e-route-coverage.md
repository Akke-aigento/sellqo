# H4e — Route Coverage Scan

_Gegenereerd: 2026-06-09T06:44:51.177Z_

| Route | Guard | Notes |
|---|---|---|
| `*` | (geen) | ⚠️ Geen guard — controleer of gating nodig is |
| `/admin` | (geen) | Wrapper voor sub-routes; auth-check op layout-niveau |
| `ads` | requireRead="ads" | ✅ |
| `ads/ai` | requireRead="ads" | ✅ |
| `ads/bolcom` | requireRead="ads" | ✅ |
| `ads/bolcom/campaigns/:id` | (geen) | OK — bewust ongated |
| `ads/bolcom/keywords` | (geen) | OK — bewust ongated |
| `ads/bolcom/search-terms` | (geen) | OK — bewust ongated |
| `ads/products` | requireRead="ads" | ✅ |
| `analytics` | requireRead="reports" | ✅ |
| `badges` | (geen) | Badges-pagina open voor alle auth-users |
| `billing` | requireRead="platform_billing" | ✅ |
| `categories` | (geen) | Categorieën open voor alle auth-users (read on products) |
| `connect` | requireRead="integrations" | ✅ |
| `connect/:connectionId` | requireRead="integrations" | ✅ |
| `connect/conflicts` | requireRead="integrations" | ✅ |
| `customers` | requireRead="customers" | ✅ |
| `customers/:customerId` | requireRead="customers" | ✅ |
| `fulfillment` | requireRead="orders" | ✅ |
| `help` | (geen) | Help-pagina open voor alle auth-users |
| `import` | requireRead="integrations" | ✅ |
| `marketing` | requireRead="marketing" | ✅ |
| `marketing/ai` | requireRead="ai_assistant" | ✅ |
| `marketing/ai-center` | requireRead="ai_coach" | ✅ |
| `marketing/campaigns/:id` | (geen) | OK — bewust ongated |
| `marketing/seo` | requireRead="seo" | ✅ |
| `marketing/translations` | requireRead="cms" | ✅ |
| `messages` | (geen) | Inbox — `inbox` resource via sidebar gating |
| `notifications` | requireRead="settings_general" | ✅ |
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
| `platform` | (geen) | Platform-admin only — afgedekt via AdminLayout role-check |
| `platform/billing` | (geen) | OK — bewust ongated |
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
| `products/:id/edit` | requireWrite="products" | ✅ |
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
| `reports` | requireRead="reports" | ✅ |
| `returns` | requireRead="returns" | ✅ |
| `returns/:id` | requireRead="returns" | ✅ |
| `settings` | requireRead="settings_general" | ✅ |
| `shipping` | (geen) | Shipping settings — gating via subpages |
| `storefront` | requireRead="themes" | ✅ |
| `supplier-documents` | requireRead="suppliers" | ✅ |
| `suppliers` | requireRead="suppliers" | ✅ |

## Samenvatting

- **Totaal admin-routes:** 77
- **Met RouteGuard:** 46
- **Zonder guard (bewust open):** 30
- **Zonder guard — ⚠️ controle nodig:** 1

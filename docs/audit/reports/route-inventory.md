# Route-inventaris — `src/App.tsx` @ `03781985`

Feitelijk uit de router gelezen. **124** `path=`-declaraties + 1 `index`-route = **125** entries (124 unieke URL's; `/admin` en de index-route delen dezelfde URL).

Controlelijst tegen runbook §6: elke route die daar ontbreekt is een gat in de auditscope.

**Guard** = wrappers op de route zelf. Admin-routes erven daarbovenop `ProtectedRoute > AdminLayout` van `/admin` (`App.tsx:200`). Een `—` bij een admin-route betekent dus: ingelogd vereist, maar **geen permissiecontrole**.

## Batch 1 — Storefront (10)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:188` | `/shop/:tenantSlug` | `ShopHome` | `CartProvider > WishlistProvider` | — |
| `App.tsx:189` | `/shop/:tenantSlug/products` | `ShopProducts` | `CartProvider > WishlistProvider` | — |
| `App.tsx:190` | `/shop/:tenantSlug/product/:productSlug` | `ShopProductDetail` | `CartProvider > WishlistProvider` | — |
| `App.tsx:191` | `/shop/:tenantSlug/page/:pageSlug` | `ShopPage` | `CartProvider > WishlistProvider` | — |
| `App.tsx:192` | `/shop/:tenantSlug/cart` | `ShopCart` | `CartProvider > WishlistProvider` | — |
| `App.tsx:193` | `/shop/:tenantSlug/checkout` | `ShopCheckout` | `CartProvider > WishlistProvider` | — |
| `App.tsx:194` | `/shop/:tenantSlug/checkout/qr-betaling` | `ShopQRPayment` | `CartProvider > WishlistProvider` | — |
| `App.tsx:195` | `/shop/:tenantSlug/order/:orderId` | `ShopOrderConfirmation` | `CartProvider > WishlistProvider` | — |
| `App.tsx:196` | `/shop/:tenantSlug/legal/:pageType` | `ShopLegalPage` | `CartProvider > WishlistProvider` | — |
| `App.tsx:197` | `/shop/:tenantSlug/wishlist` | `ShopWishlist` | `CartProvider > WishlistProvider` | — |

## Batch 2 — Betaal- & onboarding-flows (6)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:174` | `/invite/:token` | `AcceptInvitation` | **—** | — |
| `App.tsx:177` | `/actie/:token` | `TenantAction` | **—** | — |
| `App.tsx:178` | `/actie/:token/gelukt` | `TenantActionSuccess` | **—** | — |
| `App.tsx:182` | `/betaling/machtiging/:token` | `MandateActivation` | **—** | — |
| `App.tsx:374` | `/pay/success` | `PaySuccess` | **—** | — |
| `App.tsx:375` | `/pay/cancelled` | `PayCancelled` | **—** | — |

## Batch 3 — Admin: Orders & facturatie (8)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:215` | `/admin/orders` | `OrdersPage` | `RouteGuard` | `requireRead=orders` |
| `App.tsx:216` | `/admin/orders/:id` | `OrderDetailPage` | `RouteGuard` | `requireRead=orders` |
| `App.tsx:219` | `/admin/orders/quotes` | `QuotesPage` | **—** | — |
| `App.tsx:220` | `/admin/orders/quotes/new` | `QuoteFormPage` | **—** | — |
| `App.tsx:221` | `/admin/orders/quotes/:id` | `QuoteDetailPage` | **—** | — |
| `App.tsx:222` | `/admin/orders/quotes/:id/edit` | `QuoteFormPage` | **—** | — |
| `App.tsx:223` | `/admin/orders/invoices` | `InvoicesPage` | `RouteGuard` | `requireRead=invoices` |
| `App.tsx:229` | `/admin/orders/discounts` | `DiscountsPage` | `RouteGuard` | `requireRead=discount_codes` |

## Batch 4 — Admin: Producten & voorraad (14)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:208` | `/admin/fulfillment` | `FulfillmentPage` | `RouteGuard` | `requireRead=orders` |
| `App.tsx:209` | `/admin/products` | `ProductsPage` | `RouteGuard` | `requireRead=products` |
| `App.tsx:213` | `/admin/products/new` | `ProductForm` | `RouteGuard` | `requireWrite=products, requireRole=[tenant_admin, staff]` |
| `App.tsx:214` | `/admin/products/:id/edit` | `ProductForm` | `RouteGuard` | `requireWrite=products` |
| `App.tsx:217` | `/admin/returns` | `ReturnsPage` | `RouteGuard` | `requireRead=returns` |
| `App.tsx:218` | `/admin/returns/:id` | `ReturnDetailPage` | `RouteGuard` | `requireRead=returns` |
| `App.tsx:242` | `/admin/categories` | `CategoriesPage` | **—** | — |
| `App.tsx:243` | `/admin/shipping` | `ShippingPage` | **—** | — |
| `App.tsx:257` | `/admin/import` | `ImportPage` | `RouteGuard` | `requireRead=integrations` |
| `App.tsx:258` | `/admin/reports` | `ReportsPage` | `RouteGuard` | `requireRead=reports_financial` |
| `App.tsx:260` | `/admin/reports/stock` | `StockReportPage` | `RouteGuard` | `requireRead=products` |
| `App.tsx:261` | `/admin/suppliers` | `SuppliersPage` | `RouteGuard` | `requireRead=suppliers` |
| `App.tsx:262` | `/admin/purchase-orders` | `PurchaseOrdersPage` | `RouteGuard` | `requireRead=suppliers` |
| `App.tsx:263` | `/admin/supplier-documents` | `SupplierDocumentsPage` | `RouteGuard` | `requireRead=suppliers` |

## Batch 5 — Admin: Klanten & POS (9)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:207` | `/admin/badges` | `BadgesPage` | **—** | — |
| `App.tsx:240` | `/admin/customers` | `CustomersPage` | `RouteGuard` | `requireRead=customers` |
| `App.tsx:241` | `/admin/customers/:customerId` | `CustomerDetailPage` | `RouteGuard` | `requireRead=customers` |
| `App.tsx:264` | `/admin/pos` | `POSPage` | `RouteGuard` | `requireRead=pos` |
| `App.tsx:265` | `/admin/checkin` | `TicketCheckinPage` | `RouteGuard` | `requireRole=[tenant_admin, staff]` |
| `App.tsx:266` | `/admin/events` | `EventDashboardPage` | `RouteGuard` | `requireRole=[tenant_admin, staff]` |
| `App.tsx:267` | `/admin/events/:eventId` | `EventDetailPage` | `RouteGuard` | `requireRole=[tenant_admin, staff]` |
| `App.tsx:268` | `/admin/pos/:terminalId` | `POSTerminalPage` | **—** | — |
| `App.tsx:269` | `/admin/pos/terminals/:terminalId` | `POSTerminalSettingsPage` | **—** | — |

## Batch 6 — Admin: Marketing, ads & promoties (23)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:230` | `/admin/promotions` | `PromotionsPage` | `RouteGuard` | `requireRead=discount_codes` |
| `App.tsx:231` | `/admin/promotions/bundles` | `BundlesPage` | **—** | — |
| `App.tsx:232` | `/admin/promotions/volume` | `VolumeDiscountsPage` | **—** | — |
| `App.tsx:233` | `/admin/promotions/auto` | `AutoDiscountsPage` | **—** | — |
| `App.tsx:234` | `/admin/promotions/gifts` | `GiftPromotionsPage` | **—** | — |
| `App.tsx:235` | `/admin/promotions/customer-groups` | `CustomerGroupsPage` | **—** | — |
| `App.tsx:236` | `/admin/promotions/bogo` | `BogoPromotionsPage` | **—** | — |
| `App.tsx:237` | `/admin/promotions/loyalty` | `LoyaltyProgramsPage` | **—** | — |
| `App.tsx:238` | `/admin/promotions/gift-cards` | `GiftCardsPage` | **—** | — |
| `App.tsx:239` | `/admin/promotions/stacking` | `StackingRulesPage` | **—** | — |
| `App.tsx:250` | `/admin/marketing` | `MarketingPage` | `RouteGuard` | `requireRead=marketing` |
| `App.tsx:251` | `/admin/marketing/ai` | `AIMarketingHub` | `RouteGuard` | `requireRead=ai_assistant` |
| `App.tsx:252` | `/admin/marketing/ai-center` | `AIActionCenter` | `RouteGuard` | `requireRead=ai_coach` |
| `App.tsx:253` | `/admin/marketing/campaigns/:id` | `CampaignDetailPage` | **—** | — |
| `App.tsx:254` | `/admin/marketing/seo` | `SEODashboard` | `RouteGuard` | `requireRead=seo` |
| `App.tsx:255` | `/admin/marketing/translations` | `TranslationHub` | `RouteGuard` | `requireRead=cms` |
| `App.tsx:271` | `/admin/ads` | `AdsPage` | `RouteGuard` | `requireRead=ads` |
| `App.tsx:272` | `/admin/ads/bolcom` | `AdsBolcomPage` | `RouteGuard` | `requireRead=ads` |
| `App.tsx:273` | `/admin/ads/bolcom/campaigns/:id` | `AdsBolcomCampaignDetailPage` | **—** | — |
| `App.tsx:274` | `/admin/ads/bolcom/keywords` | `AdsBolcomKeywordsPage` | **—** | — |
| `App.tsx:275` | `/admin/ads/bolcom/search-terms` | `AdsBolcomSearchTermsPage` | **—** | — |
| `App.tsx:276` | `/admin/ads/ai` | `AdsAiRulesPage` | `RouteGuard` | `requireRead=ads` |
| `App.tsx:277` | `/admin/ads/products` | `AdsProductMapPage` | `RouteGuard` | `requireRead=ads` |

## Batch 7 — Admin: Overig & instellingen (12)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:206` | `/admin/messages` | `MessagesPage` | **—** | — |
| `App.tsx:245` | `/admin/billing` | `BillingPage` | `RouteGuard` | `requireRead=platform_billing` |
| `App.tsx:246` | `/admin/settings` | `SettingsPage` | `RouteGuard` | `requireRead=profile` |
| `App.tsx:247` | `/admin/connect` | `MarketplacesPage` | `RouteGuard` | `requireRead=integrations` |
| `App.tsx:248` | `/admin/connect/conflicts` | `SyncConflictsPage` | `RouteGuard` | `requireRead=integrations` |
| `App.tsx:249` | `/admin/connect/:connectionId` | `MarketplaceDetailPage` | `RouteGuard` | `requireRead=integrations` |
| `App.tsx:256` | `/admin/notifications` | `NotificationsPage` | `RouteGuard` | `requireRead=profile` |
| `App.tsx:259` | `/admin/analytics` | `AnalyticsPage` | `RouteGuard` | `requireRead=reports_analytics` |
| `App.tsx:270` | `/admin/storefront` | `StorefrontPage` | `RouteGuard` | `requireRead=themes` |
| `App.tsx:278` | `/admin/help` | `HelpPage` | **—** | — |
| `App.tsx:339` | `/admin/platform/field-mappings` | `ChannelFieldMappingAdmin` | `ProtectedRoute` | — |
| `App.tsx:205` | `/admin (index)` | `AdminDashboard` | `(erft /admin)` | — |

## Batch 8 — Platform-admin (13)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:279` | `/admin/platform` | `TenantsPage` | `ProtectedRoute` | — |
| `App.tsx:284` | `/admin/platform/billing` | `PlatformBillingPage` | `ProtectedRoute` | — |
| `App.tsx:289` | `/admin/platform/tenants/:tenantId` | `TenantDetailPage` | `ProtectedRoute` | — |
| `App.tsx:294` | `/admin/platform/coupons` | `PlatformCouponsPage` | `ProtectedRoute` | — |
| `App.tsx:299` | `/admin/platform/dashboard` | `PlatformDashboard` | `ProtectedRoute` | — |
| `App.tsx:304` | `/admin/platform/feedback` | `PlatformFeedback` | `ProtectedRoute` | — |
| `App.tsx:309` | `/admin/platform/support` | `PlatformSupport` | `ProtectedRoute` | — |
| `App.tsx:314` | `/admin/platform/changelog` | `PlatformChangelog` | `ProtectedRoute` | — |
| `App.tsx:319` | `/admin/platform/blog` | `PlatformBlog` | `ProtectedRoute` | — |
| `App.tsx:324` | `/admin/platform/health` | `PlatformHealth` | `ProtectedRoute` | — |
| `App.tsx:329` | `/admin/platform/legal` | `PlatformLegal` | `ProtectedRoute` | — |
| `App.tsx:334` | `/admin/platform/docs` | `PlatformDocs` | `ProtectedRoute` | — |
| `App.tsx:344` | `/admin/platform/payments` | `PendingPlatformPaymentsPage` | `ProtectedRoute` | — |

## Batch 9 — Publieke marketingsite (22)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:162` | `/` | `NativeLandingRedirect` | **—** | — |
| `App.tsx:165` | `/pricing` | `PricingPage` | **—** | — |
| `App.tsx:352` | `/terms` | `SellqoLegal` | **—** | — |
| `App.tsx:353` | `/privacy` | `SellqoLegal` | **—** | — |
| `App.tsx:354` | `/cookies` | `SellqoLegal` | **—** | — |
| `App.tsx:355` | `/sla` | `SellqoLegal` | **—** | — |
| `App.tsx:356` | `/acceptable-use` | `SellqoLegal` | **—** | — |
| `App.tsx:357` | `/dpa` | `SellqoLegal` | **—** | — |
| `App.tsx:358` | `/account-deletion` | `SellqoLegal` | **—** | — |
| `App.tsx:361` | `/about` | `About` | **—** | — |
| `App.tsx:362` | `/contact` | `Contact` | **—** | — |
| `App.tsx:363` | `/security` | `SecurityOverview` | **—** | — |
| `App.tsx:364` | `/security/:slug` | `SecurityPolicyPage` | **—** | — |
| `App.tsx:365` | `/blog` | `Blog` | **—** | — |
| `App.tsx:366` | `/blog/:slug` | `BlogPost` | **—** | — |
| `App.tsx:367` | `/partners` | `Partners` | **—** | — |
| `App.tsx:368` | `/careers` | `Careers` | **—** | — |
| `App.tsx:369` | `/help` | `HelpCenter` | **—** | — |
| `App.tsx:370` | `/status` | `Status` | **—** | — |
| `App.tsx:371` | `/integrations` | `Integrations` | **—** | — |
| `App.tsx:372` | `/api-docs` | `ApiDocs` | **—** | — |
| `App.tsx:373` | `/changelog` | `PublicChangelog` | **—** | — |

## Batch 10 — Auth (3)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:168` | `/auth` | `Auth` | **—** | — |
| `App.tsx:171` | `/reset-password` | `ResetPassword` | **—** | — |
| `App.tsx:185` | `/no-access` | `NoAccess` | **—** | — |

## Buiten élke batch van §6 — zie errata E-1 (5)

| Regel | Pad | Pagina-component | Guard | Permissie |
|---|---|---|---|---|
| `App.tsx:200` | `/admin` | `ProtectedRoute` | `ProtectedRoute > AdminLayout` | — |
| `App.tsx:225` | `/admin/orders/creditnotes` | `Navigate` | **—** | — |
| `App.tsx:228` | `/admin/orders/subscriptions` | `SubscriptionsPage` | **—** | — |
| `App.tsx:244` | `/admin/payments` | `PaymentsPage` | `RouteGuard` | `requireRead=payments` |
| `App.tsx:377` | `* (catch-all)` | `NotFound` | **—** | — |

## Admin-routes zonder `RouteGuard` (26)

Deze zitten wél achter `ProtectedRoute` (inloggen vereist) maar hebben géén permissiecontrole, terwijl directe buren die wél hebben. Per batch na te gaan of de pagina intern alsnog afschermt.

| Regel | Pad | Component | Buur mét guard |
|---|---|---|---|
| `App.tsx:206` | `/admin/messages` | `MessagesPage` | — |
| `App.tsx:207` | `/admin/badges` | `BadgesPage` | — |
| `App.tsx:219` | `/admin/orders/quotes` | `QuotesPage` | `/admin/orders` → requireRead=orders |
| `App.tsx:220` | `/admin/orders/quotes/new` | `QuoteFormPage` | idem |
| `App.tsx:221` | `/admin/orders/quotes/:id` | `QuoteDetailPage` | idem |
| `App.tsx:222` | `/admin/orders/quotes/:id/edit` | `QuoteFormPage` | idem |
| `App.tsx:225` | `/admin/orders/creditnotes` | `Navigate` | redirect-route |
| `App.tsx:228` | `/admin/orders/subscriptions` | `SubscriptionsPage` | `/admin/orders/discounts` → requireRead=discount_codes |
| `App.tsx:231` | `/admin/promotions/bundles` | `BundlesPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:232` | `/admin/promotions/volume` | `VolumeDiscountsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:233` | `/admin/promotions/auto` | `AutoDiscountsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:234` | `/admin/promotions/gifts` | `GiftPromotionsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:235` | `/admin/promotions/customer-groups` | `CustomerGroupsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:236` | `/admin/promotions/bogo` | `BogoPromotionsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:237` | `/admin/promotions/loyalty` | `LoyaltyProgramsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:238` | `/admin/promotions/gift-cards` | `GiftCardsPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:239` | `/admin/promotions/stacking` | `StackingRulesPage` | `/admin/promotions` → requireRead=discount_codes |
| `App.tsx:242` | `/admin/categories` | `CategoriesPage` | `/admin/products` → requireRead=products |
| `App.tsx:243` | `/admin/shipping` | `ShippingPage` | `/admin/products` → requireRead=products |
| `App.tsx:253` | `/admin/marketing/campaigns/:id` | `CampaignDetailPage` | — |
| `App.tsx:268` | `/admin/pos/:terminalId` | `POSTerminalPage` | — |
| `App.tsx:269` | `/admin/pos/terminals/:terminalId` | `POSTerminalSettingsPage` | — |
| `App.tsx:273` | `/admin/ads/bolcom/campaigns/:id` | `AdsBolcomCampaignDetailPage` | — |
| `App.tsx:274` | `/admin/ads/bolcom/keywords` | `AdsBolcomKeywordsPage` | — |
| `App.tsx:275` | `/admin/ads/bolcom/search-terms` | `AdsBolcomSearchTermsPage` | — |
| `App.tsx:278` | `/admin/help` | `HelpPage` | — |

# Route-inventaris — bron: `src/App.tsx` @ `03781985`

Feitelijk uit de router gelezen, niet uit documentatie. **124** `path=`-declaraties.
Deze lijst dient als controlelijst tegen §6 van het runbook: elke route hier die in §6 ontbreekt is een gat in de audit-scope, en omgekeerd.

Kolom *Guard* toont de wrappers rond het element (`RouteGuard`, `CartProvider`, ...); `—` betekent geen wrapper op de route zelf. Admin-routes erven daarnaast de guard van het `/admin`-ouderelement (regel 200).

## Publiek / marketing (15)

| Regel | Pad | Pagina-component | Guard |
|---|---|---|---|
| `App.tsx:162` | `/` | `NativeLandingRedirect` | — |
| `App.tsx:165` | `/pricing` | `PricingPage` | — |
| `App.tsx:361` | `/about` | `About` | — |
| `App.tsx:362` | `/contact` | `Contact` | — |
| `App.tsx:363` | `/security` | `SecurityOverview` | — |
| `App.tsx:364` | `/security/:slug` | `SecurityPolicyPage` | — |
| `App.tsx:365` | `/blog` | `Blog` | — |
| `App.tsx:366` | `/blog/:slug` | `BlogPost` | — |
| `App.tsx:367` | `/partners` | `Partners` | — |
| `App.tsx:368` | `/careers` | `Careers` | — |
| `App.tsx:369` | `/help` | `HelpCenter` | — |
| `App.tsx:370` | `/status` | `Status` | — |
| `App.tsx:371` | `/integrations` | `Integrations` | — |
| `App.tsx:372` | `/api-docs` | `ApiDocs` | — |
| `App.tsx:373` | `/changelog` | `PublicChangelog` | — |

## Juridisch (publiek) (7)

| Regel | Pad | Pagina-component | Guard |
|---|---|---|---|
| `App.tsx:352` | `/terms` | `SellqoLegal` | — |
| `App.tsx:353` | `/privacy` | `SellqoLegal` | — |
| `App.tsx:354` | `/cookies` | `SellqoLegal` | — |
| `App.tsx:355` | `/sla` | `SellqoLegal` | — |
| `App.tsx:356` | `/acceptable-use` | `SellqoLegal` | — |
| `App.tsx:357` | `/dpa` | `SellqoLegal` | — |
| `App.tsx:358` | `/account-deletion` | `SellqoLegal` | — |

## Auth & token-landings (9)

| Regel | Pad | Pagina-component | Guard |
|---|---|---|---|
| `App.tsx:168` | `/auth` | `Auth` | — |
| `App.tsx:171` | `/reset-password` | `ResetPassword` | — |
| `App.tsx:174` | `/invite/:token` | `AcceptInvitation` | — |
| `App.tsx:177` | `/actie/:token` | `TenantAction` | — |
| `App.tsx:178` | `/actie/:token/gelukt` | `TenantActionSuccess` | — |
| `App.tsx:182` | `/betaling/machtiging/:token` | `MandateActivation` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:185` | `/no-access` | `NoAccess` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:374` | `/pay/success` | `PaySuccess` | — |
| `App.tsx:375` | `/pay/cancelled` | `PayCancelled` | — |

## Storefront (/shop) (10)

| Regel | Pad | Pagina-component | Guard |
|---|---|---|---|
| `App.tsx:188` | `/shop/:tenantSlug` | `ShopHome` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:189` | `/shop/:tenantSlug/products` | `ShopProducts` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:190` | `/shop/:tenantSlug/product/:productSlug` | `ShopProductDetail` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:191` | `/shop/:tenantSlug/page/:pageSlug` | `ShopPage` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:192` | `/shop/:tenantSlug/cart` | `ShopCart` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:193` | `/shop/:tenantSlug/checkout` | `ShopCheckout` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider` |
| `App.tsx:194` | `/shop/:tenantSlug/checkout/qr-betaling` | `ShopQRPayment` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+ProtectedRoute` |
| `App.tsx:195` | `/shop/:tenantSlug/order/:orderId` | `ShopOrderConfirmation` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+CartProvider+WishlistProvider+ProtectedRoute+AdminLayout` |
| `App.tsx:196` | `/shop/:tenantSlug/legal/:pageType` | `ShopLegalPage` | `CartProvider+WishlistProvider+CartProvider+WishlistProvider+ProtectedRoute+AdminLayout` |
| `App.tsx:197` | `/shop/:tenantSlug/wishlist` | `ShopWishlist` | `CartProvider+WishlistProvider+ProtectedRoute+AdminLayout` |

## Admin — platform (14)

| Regel | Pad | Pagina-component | Guard |
|---|---|---|---|
| `App.tsx:279` | `/admin/platform` | `TenantsPage` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:284` | `/admin/platform/billing` | `PlatformBillingPage` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:289` | `/admin/platform/tenants/:tenantId` | `TenantDetailPage` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:294` | `/admin/platform/coupons` | `PlatformCouponsPage` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:299` | `/admin/platform/dashboard` | `PlatformDashboard` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:304` | `/admin/platform/feedback` | `PlatformFeedback` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:309` | `/admin/platform/support` | `PlatformSupport` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:314` | `/admin/platform/changelog` | `PlatformChangelog` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:319` | `/admin/platform/blog` | `PlatformBlog` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:324` | `/admin/platform/health` | `PlatformHealth` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:329` | `/admin/platform/legal` | `PlatformLegal` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:334` | `/admin/platform/docs` | `PlatformDocs` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:339` | `/admin/platform/field-mappings` | `ChannelFieldMappingAdmin` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:344` | `/admin/platform/payments` | `PendingPlatformPaymentsPage` | `ProtectedRoute` |

## Admin — tenant (69)

| Regel | Pad | Pagina-component | Guard |
|---|---|---|---|
| `App.tsx:200` | `/admin` | `AdminDashboard` | `ProtectedRoute+AdminLayout` |
| `App.tsx:206` | `/admin/messages` | `MessagesPage` | `RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:207` | `/admin/badges` | `BadgesPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:208` | `/admin/fulfillment` | `FulfillmentPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:209` | `/admin/products` | `ProductsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:213` | `/admin/products/new` | `ProductForm` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:214` | `/admin/products/:id/edit` | `ProductForm` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:215` | `/admin/orders` | `OrdersPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:216` | `/admin/orders/:id` | `OrderDetailPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:217` | `/admin/returns` | `ReturnsPage` | `RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:218` | `/admin/returns/:id` | `ReturnDetailPage` | `RouteGuard+RouteGuard` |
| `App.tsx:219` | `/admin/orders/quotes` | `QuotesPage` | `RouteGuard` |
| `App.tsx:220` | `/admin/orders/quotes/new` | `QuoteFormPage` | `RouteGuard` |
| `App.tsx:221` | `/admin/orders/quotes/:id` | `QuoteDetailPage` | `RouteGuard` |
| `App.tsx:222` | `/admin/orders/quotes/:id/edit` | `QuoteFormPage` | `RouteGuard+RouteGuard` |
| `App.tsx:223` | `/admin/orders/invoices` | `InvoicesPage` | `RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:225` | `/admin/orders/creditnotes` | `Navigate` | `RouteGuard+RouteGuard` |
| `App.tsx:228` | `/admin/orders/subscriptions` | `SubscriptionsPage` | `RouteGuard+RouteGuard` |
| `App.tsx:229` | `/admin/orders/discounts` | `DiscountsPage` | `RouteGuard+RouteGuard` |
| `App.tsx:230` | `/admin/promotions` | `PromotionsPage` | `RouteGuard` |
| `App.tsx:231` | `/admin/promotions/bundles` | `BundlesPage` | — |
| `App.tsx:232` | `/admin/promotions/volume` | `VolumeDiscountsPage` | — |
| `App.tsx:233` | `/admin/promotions/auto` | `AutoDiscountsPage` | `RouteGuard` |
| `App.tsx:234` | `/admin/promotions/gifts` | `GiftPromotionsPage` | `RouteGuard+RouteGuard` |
| `App.tsx:235` | `/admin/promotions/customer-groups` | `CustomerGroupsPage` | `RouteGuard+RouteGuard` |
| `App.tsx:236` | `/admin/promotions/bogo` | `BogoPromotionsPage` | `RouteGuard+RouteGuard` |
| `App.tsx:237` | `/admin/promotions/loyalty` | `LoyaltyProgramsPage` | `RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:238` | `/admin/promotions/gift-cards` | `GiftCardsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:239` | `/admin/promotions/stacking` | `StackingRulesPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:240` | `/admin/customers` | `CustomersPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:241` | `/admin/customers/:customerId` | `CustomerDetailPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:242` | `/admin/categories` | `CategoriesPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:243` | `/admin/shipping` | `ShippingPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:244` | `/admin/payments` | `PaymentsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:245` | `/admin/billing` | `BillingPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:246` | `/admin/settings` | `SettingsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:247` | `/admin/connect` | `MarketplacesPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:248` | `/admin/connect/conflicts` | `SyncConflictsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:249` | `/admin/connect/:connectionId` | `MarketplaceDetailPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:250` | `/admin/marketing` | `MarketingPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:251` | `/admin/marketing/ai` | `AIMarketingHub` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:252` | `/admin/marketing/ai-center` | `AIActionCenter` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:253` | `/admin/marketing/campaigns/:id` | `CampaignDetailPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:254` | `/admin/marketing/seo` | `SEODashboard` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:255` | `/admin/marketing/translations` | `TranslationHub` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:256` | `/admin/notifications` | `NotificationsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:257` | `/admin/import` | `ImportPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:258` | `/admin/reports` | `ReportsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:259` | `/admin/analytics` | `AnalyticsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:260` | `/admin/reports/stock` | `StockReportPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:261` | `/admin/suppliers` | `SuppliersPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:262` | `/admin/purchase-orders` | `PurchaseOrdersPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:263` | `/admin/supplier-documents` | `SupplierDocumentsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:264` | `/admin/pos` | `POSPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:265` | `/admin/checkin` | `TicketCheckinPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:266` | `/admin/events` | `EventDashboardPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:267` | `/admin/events/:eventId` | `EventDetailPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:268` | `/admin/pos/:terminalId` | `POSTerminalPage` | `RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:269` | `/admin/pos/terminals/:terminalId` | `POSTerminalSettingsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:270` | `/admin/storefront` | `StorefrontPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:271` | `/admin/ads` | `AdsPage` | `RouteGuard+RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:272` | `/admin/ads/bolcom` | `AdsBolcomPage` | `RouteGuard+RouteGuard+RouteGuard` |
| `App.tsx:273` | `/admin/ads/bolcom/campaigns/:id` | `AdsBolcomCampaignDetailPage` | `RouteGuard+RouteGuard+ProtectedRoute` |
| `App.tsx:274` | `/admin/ads/bolcom/keywords` | `AdsBolcomKeywordsPage` | `RouteGuard+RouteGuard+ProtectedRoute` |
| `App.tsx:275` | `/admin/ads/bolcom/search-terms` | `AdsBolcomSearchTermsPage` | `RouteGuard+RouteGuard+ProtectedRoute` |
| `App.tsx:276` | `/admin/ads/ai` | `AdsAiRulesPage` | `RouteGuard+RouteGuard+ProtectedRoute` |
| `App.tsx:277` | `/admin/ads/products` | `AdsProductMapPage` | `RouteGuard+ProtectedRoute` |
| `App.tsx:278` | `/admin/help` | `HelpPage` | `ProtectedRoute+ProtectedRoute` |
| `App.tsx:377` | `*` | `NotFound` | — |


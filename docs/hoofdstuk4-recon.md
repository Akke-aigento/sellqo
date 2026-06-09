# Hoofdstuk 4 — Frontend gating recon

Datum: 2026-06-09
Status: RECON — geen code-wijzigingen
Scope: alle admin-UI (`src/pages/admin/**`, `src/components/admin/**`,
route-config in `src/App.tsx`, sidebar in `src/components/admin/sidebar/`).

Bron-van-waarheid voor permissies: `src/hooks/useCan.ts` (`PERMISSION_MATRIX`)
gespiegeld op `docs/sellqo-fase2-masterplan.md` Hoofdstuk 2.

---

## 0. Status-quo (baseline meting)

| Primitive | Aanwezig | Gebruikt in `src/` |
|---|---|---|
| `useCan(action, resource)` hook | ✅ `src/hooks/useCan.ts` | 8 call-sites |
| `PermissionGate` wrapper | ✅ `src/components/PermissionGate.tsx` | 10 usages |
| `<ProtectedRoute requires={...}>` | ✅ `src/components/ProtectedRoute.tsx` | **0** usages (`requires=[` op `/admin/*` = 0) |
| `/no-access` route | ✅ `src/pages/NoAccess.tsx` | doelpagina van `ProtectedRoute` |
| Sidebar `allowedRoles` / `excludeRoles` filtering | ✅ `src/components/admin/sidebar/sidebarConfig.ts` | toegepast op marketing/warehouse |

**Gating-dekkingsgraad admin-UI: ~5%.** Foundation is volledig aanwezig
maar nog vrijwel nergens aangeroepen. Bestaande call-sites zijn
geconcentreerd in de credit-note flow (`OrderDetail`, `CreditNotes`,
`CreditNotesTable`, `CreateCreditNoteFromInvoiceButton`,
`OrderCreditNotesSection`) plus één marketplace setting
(`OdooB2CAggregationSettings`).

---

## 1. Sweep per gating-laag (A–G)

### A. Sidebar / navigatie

`src/components/admin/sidebar/sidebarConfig.ts` gebruikt
`allowedRoles` / `excludeRoles` op item-niveau plus de helper-arrays
`WAREHOUSE_ALLOWED_ITEMS` en `MARKETING_ALLOWED_ITEMS`. Dat dekt de
rollen `warehouse` en `marketing` correct.

**Gaten:**
- Geen filtering op `viewer` of `accountant` — die rollen zien nu álle
  items, ook items waarvan de pagina-actie write-only is.
- `excludeRoles` is een blacklist; nieuwe items vergeten zo nemen
  rollen automatisch mee. Voorstel: complementeer met een
  `requireRead?: Resource` veld dat via `useCan('read', resource)`
  gecheckt wordt (whitelist op basis van de matrix).
- `AdminHeader` (top-bar) en `AdminMobileBottomNav` zijn nog niet
  geverifieerd op gating; check moet in H4a.
- Quick-actions / "+ Nieuw"-knoppen in headers (bv. `Dashboard`,
  `OrderDetail`) zitten buiten de sidebar.

### B. Route-level guards

`src/App.tsx` gebruikt `<ProtectedRoute>` 1× zonder `requires`
(omhult de hele `/admin/*` boom) en 12× met `requirePlatformAdmin`
(voor `/admin/platform/*`).

**Gat:** `requires={[...]}` wordt nergens gebruikt. Alle role-gating
gebeurt nu impliciet via sidebar-visibility — een gebruiker die de URL
direct intikt komt gewoon binnen. Voor write-only resources zou de
pagina vervolgens RLS-fouten geven i.p.v. een nette `/no-access`.

**Voorgestelde route-rol-mapping (read-niveau, H4a):**

| Route-cluster | `requires` |
|---|---|
| `/admin/orders`, `/admin/fulfillment`, `/admin/products`, `/admin/categories` | alle rollen (geen `requires` nodig) |
| `/admin/orders/invoices`, `/admin/credit-notes` | `tenant_admin, staff, accountant, viewer` (excl. warehouse, marketing) |
| `/admin/payments`, `/admin/billing` | idem |
| `/admin/returns` | excl. marketing |
| `/admin/customers`, `/admin/customers/:id` | excl. warehouse |
| `/admin/marketing/*`, `/admin/ads/*`, `/admin/promotions/*`, `/admin/seo` | `tenant_admin, staff, viewer, marketing` |
| `/admin/settings`, `/admin/notifications`, `/admin/connect`, `/admin/import`, `/admin/shipping` | excl. marketing |
| `/admin/suppliers`, `/admin/purchase-orders`, `/admin/supplier-documents` | `tenant_admin, accountant, warehouse` |
| `/admin/storefront`, `/admin/pos*` | excl. marketing |
| `/admin/reports`, `/admin/analytics` | excl. warehouse |

### C. Page-level action bars

Per pagina-categorie, alleen de meest zichtbare top-bar acties:

| Pagina | Actie/element | `useCan(action, resource)` | Status |
|---|---|---|---|
| `/admin/orders` (`Orders.tsx`) | "Nieuw order" / import knoppen | `write, orders` | ❌ |
| `/admin/orders` | Bulk export | `read, orders` | ❌ |
| `/admin/products` (`Products.tsx`) | "Nieuw product", import, bulk-edit | `write, products` | ❌ |
| `/admin/customers` (`Customers.tsx`) | "Nieuwe klant", import, bulk-tag | `write, customers` | ❌ |
| `/admin/orders/invoices` (`Invoices.tsx`) | "Handmatige factuur", export | `write, invoices` | ❌ |
| `/admin/credit-notes` (`CreditNotes.tsx`) | "Nieuwe creditnota" | `write, credit_notes` | ✅ |
| `/admin/returns` (`Returns.tsx`) | "Nieuwe retour" | `write, returns` | ❌ |
| `/admin/marketing` (`Marketing.tsx`) | "Nieuwe campagne" | `write, marketing` | ❌ |
| `/admin/promotions` (`Discounts.tsx`) | "Nieuwe kortingscode" | `write, discount_codes` | ❌ |
| `/admin/ads` (`Ads.tsx`) | "Nieuwe campagne", "Budget aanpassen" | `write, ads` / `write, ad_budgets` | ❌ |
| `/admin/seo` (`SEODashboard.tsx`) | "Run analyse", "Bulk-optimize" | `write, seo` | ❌ |
| `/admin/storefront` | Publish / theme save | `write, themes` | ❌ |
| `/admin/suppliers`, `/admin/purchase-orders` | Nieuw / bulk | `write, suppliers` | ❌ |
| `/admin/shipping` | Methodes toevoegen | `write, settings_general` | ❌ |
| `/admin/notifications` | Configure | `write, settings_general` | ❌ |
| `/admin/connect` | Connect / disconnect | `write, integrations` | ❌ |
| `/admin/billing` | Plan wisselen, factuur betalen | `write, platform_billing` (read voor accountant) | ❌ |
| `/admin/settings` | Tabs zie §G | divers | ❌ |
| `/admin/marketing/translations` | Run translation job | `write, cms` | ❌ |
| `/admin/pos` | Kassa open/sluit | `write, pos` | ❌ |
| `/admin/fulfillment` | Print labels, bulk-ship | `write, orders` | ❌ |

### D. Row-level acties (tabellen + 3-puntjes-menu's)

Hotspots (ongated):

- `Orders.tsx` / `OrderBulkActions.tsx` — status-wijzigen, refund,
  delete, mark-paid → `write, orders` + `write, refunds` +
  `correct, order_status` (alleen tenant_admin).
- `Products.tsx` — duplicate, archive, delete → `write, products`.
- `Customers.tsx` / `CustomerDetail.tsx` — delete, merge, GDPR-export →
  `write, customers`.
- `Invoices.tsx` / `CreditNotesTable.tsx` — creditnota maken, email,
  cancel → `write, credit_notes` (✅ creditnota deels gated).
- `Returns.tsx` — refund + restock → `write, refunds`.
- `Marketing.tsx` — send-now, duplicate, archive → `write, marketing`.
- `Discounts.tsx` / `BogoPromotions.tsx` / `VolumeDiscounts.tsx` /
  `AutoDiscounts.tsx` / `Bundles.tsx` / `GiftPromotions.tsx` /
  `LoyaltyPrograms.tsx` / `StackingRules.tsx` / `GiftCards.tsx` —
  edit/delete → `write, discount_codes` of `write, loyalty` of
  `write, volume_discounts`.
- `Ads.tsx` / `AdsBolcom.tsx` / `AdsAiRules.tsx` — start/pauze,
  budget-update → `write, ads` + `write, ad_budgets`.
- `Suppliers.tsx` / `PurchaseOrders.tsx` / `SupplierDocuments.tsx` —
  delete, mark-received → `write, suppliers`.
- `Notifications.tsx` (admin notification settings) → `write,
  settings_general`.
- `Tenants.tsx` / `Subscriptions.tsx` — platform-admin only (al
  ge-route-gated, dus row-level gating overbodig).

### E. Modals / Dialogs met destructieve of high-trust acties

| Component | Actie | `useCan(action, resource)` | Status |
|---|---|---|---|
| `StripeDisconnectDialog` | type-to-confirm disconnect | `write, integrations` | ⚠ type-to-confirm aanwezig, geen role-check |
| `CreditNoteDialog` / `NewCreditNoteDialog` | "Direct verzenden" + email | `write, credit_notes` | ✅ |
| `OrderStatusCorrectionDialog` | bypass fulfillment-matrix | `correct, order_status` (tenant_admin only) | ❌ |
| `CustomerFormDialog` | delete/merge customer | `write, customers` | ❌ |
| `DangerZone` (in `Settings.tsx` tab) | rotate API key, delete tenant | `write, settings_general` (+ platform_admin voor delete) | ❌ |
| `ManualInvoiceDialog` | create handmatige factuur | `write, invoices` | ❌ |
| `FetchExternalLabelDialog` | shipping API call | `write, orders` | ❌ |
| `BatchPrintDialog` / `BankReconciliationUpload` | bulk-doc / financieel | `write, orders` / `write, payments` | ❌ |
| `DiscountCodeDialog` | create/edit code | `write, discount_codes` | ❌ |
| `ShippingMethodDialog` | edit shipping methode | `write, settings_general` | ❌ |
| `CustomerMessageDialog` | reply naar klant | `write, inbox` | ❌ |

### F. Field-level read-only / hidden

| Veld | Locatie | Toegestane rollen (read) | Toegestane rollen (write) |
|---|---|---|---|
| `cost_price` / `purchase_price` | `ProductForm.tsx`, `Products.tsx` kolom | `tenant_admin, accountant, warehouse` | `tenant_admin` |
| `ad_budgets.daily_budget` / `total_budget` | `Ads.tsx`, `AdsBolcom.tsx` | `tenant_admin, accountant` | `tenant_admin` |
| `stripe_account_id`, `stripe_secret_key` | `Settings.tsx` integrations tab | `tenant_admin` | `tenant_admin` |
| `api_keys` / `storefront_api_keys` (key value) | `Settings.tsx`, `Connect.tsx` | `tenant_admin` (alleen prefix tonen) | `tenant_admin` |
| `tenant.delete` / `tenant.suspend` | `Settings.tsx` danger-zone | `tenant_admin` | `platform_admin` |
| Customer notes (interne) | `CustomerDetail.tsx` | `tenant_admin, staff, viewer` | `tenant_admin, staff` |
| Refund-amount input op order | `OrderDetail.tsx` | tenant_admin, accountant | tenant_admin |
| Klantemail / GDPR-export | `CustomerDetail.tsx` | tenant_admin | tenant_admin |

### G. Tabs binnen pagina's

| Pagina | Tab | Visibility-regel |
|---|---|---|
| `Invoices.tsx` | "Creditnota's" | excl. warehouse, marketing (matrix `credit_notes`) |
| `Settings.tsx` | "Billing" | `tenant_admin, accountant` |
| `Settings.tsx` | "Team" | `tenant_admin` only |
| `Settings.tsx` | "Integrations / API keys" | `tenant_admin` only |
| `Settings.tsx` | "Theme / Branding" | `tenant_admin, staff` |
| `Settings.tsx` | "Danger Zone" | `tenant_admin` (+ platform_admin voor delete) |
| `Marketing.tsx` | "Segments" | `tenant_admin, staff, marketing` |
| `Marketing.tsx` | "Ads" | excl. warehouse |
| `CustomerDetail.tsx` | "Orders" / "Notes" / "Loyalty" | matrix per resource |
| `OrderDetail.tsx` | "Refund" sectie | excl. warehouse, marketing |
| `Ads.tsx` | "Budget" sub-tab | `tenant_admin, accountant` read; `tenant_admin` write |

---

## 2. Hotspot-ranking (op basis van zichtbaarheid + risico)

1. **Orders + OrderDetail** — meeste rol-gemixte UI, refund/status/delete.
2. **Products + ProductForm** — `cost_price` field gating is concreet
   security/privacy-risico voor staff/marketing.
3. **Customers + CustomerDetail** — GDPR-acties, notes, delete.
4. **Invoices + CreditNotes** — financieel gevoelig; tabs + acties.
5. **Settings** — danger zone + API keys + integration disconnect.
6. **Marketing / Ads** — budgets + send-now, tabs voor marketing-rol.
7. **Promotions cluster** — write-acties voor marketing.
8. **Suppliers + PurchaseOrders** — tenant_admin write-only.
9. **Storefront / Themes** — publish-knop.
10. **POS + Fulfillment** — warehouse-only schrijfacties.

Lager-frequentie (kan in latere H4-batches): `Notifications`, `Help`,
`PlatformDocs`, `Analytics`, `Reports`, `SyncConflicts`,
`MarketplaceDetail`, `ChannelFieldMappingAdmin`,
`PendingPlatformPaymentsPage`, `Badges`, `GiftCardDesigns`,
`StackingRules`, `TranslationHub`.

---

## 3. Patronen-voorstel (geen implementatie)

- `PermissionGate` (bestaat) — gebruik voor write-acties.
- `GatedButton` — nieuw: rendert `<Button disabled>` + tooltip
  "Geen toegang — vraag je tenant-admin" als de gebruiker geen recht
  heeft, zodat de UI consistent blijft (zie beslispunt §5).
- `useCanAny(checks: [action, resource][])` — handig voor tab-visibility
  ("zichtbaar als read OF write op een van X resources").
- `<ProtectedAdminRoute resource="..." action="read">` wrapper —
  thin layer boven `ProtectedRoute` die automatisch de juiste rollen
  uit de matrix afleidt; voorkomt drift tussen route-rol-arrays en
  matrix.
- `<ReadOnlyField>` wrapper voor field-level — toont waarde maar
  zonder input/edit-handles wanneer `useCan('write', resource)`
  false is.
- `<RoleBadge />` (klein label naast page-title) wanneer rol alleen
  read mag — zie beslispunt §5.

---

## 4. Risico-analyse

- **Hide-vs-disable**: hide voorkomt UI-verwarring maar maakt support
  lastiger ("waar is de knop?"). Disable+tooltip is duidelijker en
  consistenter met andere SaaS-tools. Combinatie: hide voor
  niet-relevante features (marketing ziet geen "Refund"), disable
  voor write op een resource die de rol wel kan lezen.
- **Direct-URL bypass**: zonder route-`requires` kan een viewer
  `/admin/settings` openen en de pagina laden (al wordt RLS-write
  geblokkeerd backend-side). H4a moet dit dichten.
- **Sidebar-blacklist drift**: nieuwe items vergeten in
  `excludeRoles` lekken automatisch. Voorstel: tijdens H4a omzetten
  naar whitelist via matrix.
- **Account-switcher (`PlatformViewMode`)**: platform_admin in
  tenant-view ziet alles, in tenant-specifieke pagina's moet UI de
  effectieve rol respecteren — `useCan` doet dat al via
  `useAuth().roles`, maar `usePlatformViewMode` mag dit niet
  bypassen tenzij admin expliciet "platform view" actief heeft.
- **Mixed-tenant rollen**: gebruiker met `tenant_admin` op tenant A
  en `viewer` op tenant B — `useTenant().currentTenant.id` is de
  bron-van-waarheid. `useAuth().roles` filtert al per actieve tenant
  (te verifiëren in H4a).
- **Edge-case fallbacks**: warehouse op `OrderDetail` zou
  "Status corrigeren" disabled moeten zien maar wel "Mark as shipped"
  enabled; vergt action-specifieke (niet resource-brede) gating.

---

## 5. Open beslispunten

| # | Vraag | Voorstel |
|---|---|---|
| H4-1 | Hide vs disable bij ongated write-actie? | Hybride: **disable+tooltip** standaard; hide alleen als het hele feature voor de rol niet relevant is (sidebar-niveau). |
| H4-2 | "Read-only mode" labeltje naast page-title als rol alleen read? | Ja, kleine `<Badge>Alleen-lezen</Badge>` rechts van de page-title, alleen tonen wanneer er minimaal één write-actie ge-hide/disabled is. |
| H4-3 | Tooltip-tekst standaardiseren? | Eén constante: `"Geen toegang — vraag je tenant-admin om je rechten aan te passen."` (lange variant in tooltip, korte `"Geen toegang"` in `aria-label`). |
| H4-4 | Account-switcher zichtbaar voor platform_admin op tenant-pagina's? | Ja, blijft zichtbaar — platform_admin moet snel kunnen wisselen; respecteer `PlatformViewModeProvider` voor admin-bypass-toggle. |
| H4-5 | Multi-tenant rol-conflict (admin@A + viewer@B): is `useAuth().roles` reeds gefilterd op `currentTenant.id`? | **Open** — moet in H4a empirisch geverifieerd worden; zo niet, fix in `useAuth` of via `useCan` overlay. |
| H4-6 | Whitelist vs blacklist in `sidebarConfig`? | Whitelist via nieuw `requireRead?: Resource` veld; legacy `allowedRoles` / `excludeRoles` blijven optioneel voor non-resource items. |
| H4-7 | Field-level `cost_price` gating: hide of mask (`••• EUR`)? | Mask in tabel/list, hide input in form (vermijdt accidentele write-poging). |
| H4-8 | Page-level RouteGuard moet 403 redirecten met context-message? | Ja, `Navigate to="/no-access?from=/admin/invoices"` zodat `/no-access` page kan tonen "Je rol mist toegang tot Facturen". |

---

## 6. Voorgestelde sub-volgorde

| Batch | Scope | Verwachte omvang |
|---|---|---|
| **H4a** | Sidebar whitelist-conversie + route-`requires` op álle `/admin/*` clusters + `/no-access` context-message. Verifieer multi-tenant rol-resolving. | 1 dag |
| **H4b** | Hotspot pagina-acties: Orders, OrderDetail, Products, ProductForm, Customers, CustomerDetail. Top-bar + row-level + bulk-acties. Introductie `GatedButton` + `useCanAny`. | 2 dagen |
| **H4c** | Financieel cluster: Invoices, CreditNotes (al deels), Returns, Payments, Billing. Tab-gating in Invoices + Settings. | 1 dag |
| **H4d** | Marketing / Ads / Promotions / SEO / CMS / Translations / Storefront-publish: write-acties + budget-field gating. | 1.5 dag |
| **H4e** | Settings + Connect + Notifications + Suppliers + PurchaseOrders + Shipping + POS + Fulfillment. Danger-zone + API-key masking. | 1.5 dag |
| **H4f** | Field-level read-only (`cost_price`, `ad_budgets`, `stripe_*`), `ReadOnlyField` wrapper, `RoleBadge` indicator. | 1 dag |
| **H4g** | Regressie: matrix-runner script dat alle `useCan(...)` aanroepen scant en vergelijkt met `PERMISSION_MATRIX`. Visuele rol-walkthrough (warehouse, marketing, viewer, accountant). | 0.5 dag |

---

## 7. Inventory referentie — kandidaat-pagina's per cluster

- **Orders cluster**: `Orders`, `OrderDetail`, `Fulfillment`, `Returns`,
  `ReturnDetail`, `Invoices`, `CreditNotes`, `Quotes`, `QuoteForm`,
  `QuoteDetail`, `Payments`, `PendingPlatformPaymentsPage`.
- **Catalog cluster**: `Products`, `ProductForm`, `Categories`,
  `Bundles`, `GiftCards`, `GiftCardDetail`, `GiftCardDesigns`.
- **Customer cluster**: `Customers`, `CustomerDetail`, `CustomerGroups`,
  `Messages`.
- **Marketing cluster**: `Marketing`, `CampaignDetail`,
  `AIMarketingHub`, `AIActionCenter`, `SEODashboard`,
  `TranslationHub`, `Discounts`, `BogoPromotions`, `VolumeDiscounts`,
  `AutoDiscounts`, `GiftPromotions`, `LoyaltyPrograms`,
  `StackingRules`, `Promotions`.
- **Ads cluster**: `Ads`, `AdsBolcom`, `AdsBolcomCampaignDetail`,
  `AdsBolcomKeywords`, `AdsBolcomSearchTerms`, `AdsProductMap`,
  `AdsAiRules`.
- **Settings cluster**: `Settings`, `Notifications`, `Billing`,
  `Subscriptions`, `Storefront`, `Shipping`,
  `ChannelFieldMappingAdmin`, `Import`, `SyncConflicts`.
- **Supplier cluster**: `Suppliers`, `PurchaseOrders`,
  `SupplierDocuments`.
- **POS cluster**: `POS`, `POSTerminal`, `POSTerminalSettings`.
- **Reporting cluster**: `Reports`, `Analytics`, `Dashboard`.
- **Platform-only** (al `requirePlatformAdmin` op route): `Tenants`,
  `PlatformDocs`, `Marketplaces`, `MarketplaceDetail`.

---

## 8. Volgende stap

Bevestiging gevraagd op beslispunten §5 (H4-1 t/m H4-8) vóór start
H4a. Bij groen licht: implementatie begint met sidebar
whitelist-conversie + route-`requires` (H4a).
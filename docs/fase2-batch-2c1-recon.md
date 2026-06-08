# Fase 2 — Batch 2C1 Recon: Catalog cluster

Datum: 2026-06-08
Scope: producten, varianten, voorraad, categorieën, leveranciers, inkoop, bundels,
reviews, vertalingen, specs en gerelateerde catalog-meta. **Geen code-wijzigingen** —
enkel inventarisatie + voorgestelde policies + edge-function role-checks + open
beslispunten.

---

## 1. Tabellen-inventaris & RLS-classificatie

Legende: ✅ rol-aware (`has_tenant_role`) · ⚠️ tenant-scope maar **geen rol-check**
(elke tenant-user kan schrijven, incl. warehouse/viewer/marketing/accountant) ·
❌ unbounded / ontbrekend.

### 1a. Tabellen uit de spec die **niet bestaan** in deze codebase

| Verwachte tabel | Status | Opmerking |
|---|---|---|
| `product_options` | ❌ | Opties leven binnen `product_variant_options` |
| `product_images`, `product_videos`, `product_documents` | ❌ apart | Media zit op `products.images[]` / `media_assets` / `product_files` |
| `product_pricing_tiers` | ❌ | B2B-pricing in `customer_group_product_prices` |
| `product_costs` | ❌ aparte tabel | `cost_price` zit als kolom op `products` + `product_variants` |
| `collections`, `collection_products` | ❌ | Alleen `categories` |
| `tags`, `product_tags` | ❌ | Tags zijn `text[]` kolom op `products` |
| `inventory`, `inventory_movements`, `stock_adjustments`, `stock_alerts` | ❌ | Stock op `products.stock_quantity` + `product_variants.stock`; wel `inventory_sync_log` |
| `category_assignments` / `category_translations` | ❌ apart | Junction = `product_categories`; i18n via `content_translations` |
| `attribute_definitions` | ❌ | Specs in `product_specifications` + `product_custom_specs` |
| `product_questions` | ❌ | Alleen `external_reviews` |
| `bundle_components`, `bundle_pricing` | ❌ | Bundels: `product_bundles` + `product_bundle_items` + `bundle_products` |

Spec-functies die **niet bestaan**: `create-product`, `update-product`, `delete-product`,
`stock-adjustment`, `bulk-stock-update`, `upload-product-image`,
`generate-product-thumbnail`, `margin-calculator`, `pricing-calculator`,
`ai-product-description-generator`, `ai-tag-suggester`, `import-products`.
Productschrijven gebeurt **direct via PostgREST** vanuit admin-UI hooks → RLS is de
enige verdedigingslinie.

### 1b. Tabellen die wél bestaan

| Tabel | Huidige RLS | Klasse | Opmerking |
|---|---|---|---|
| `products` | rol-aware (INSERT/UPDATE: `tenant_admin`+`staff`, DELETE: `tenant_admin`) + public-read actief + platform-admin | ✅ | OK. `cost_price` lekt naar alle tenant-rollen (zie §6.3). |
| `product_variants` | rol-aware ALL via parent + service-role + anon-read actief | ✅ | OK |
| `product_variant_options` | rol-aware ALL `tenant_admin`+`staff` + anon-read | ✅ | OK |
| `categories` | rol-aware (INSERT/UPDATE: `tenant_admin`+`staff`; DELETE: `tenant_admin`) + public-read | ⚠️ partial | **Marketing ontbreekt** in write — toevoegen |
| `product_categories` (junction) | tenant-scope via `user_roles` join, **geen rol-check** | ⚠️ | Naar `['tenant_admin','staff','marketing']` |
| `product_files` | tenant-scope, **geen rol-check** | ⚠️ | Write → `['tenant_admin','staff']` |
| `product_specifications` | tenant-scope, **geen rol-check** | ⚠️ | Idem |
| `product_custom_specs` | tenant-scope, **geen rol-check** | ⚠️ | Idem |
| `product_channel_warnings` | tenant-scope, **geen rol-check** | ⚠️ | Idem |
| `product_suppliers` (junction) | tenant-scope via `user_roles`, **geen rol-check** | ⚠️ | Inkoopprijs — beperken tot admin/staff/accountant/warehouse |
| `suppliers` | idem | ⚠️ | Idem; marketing/viewer NIET |
| `supplier_documents` | idem | ⚠️ | Idem |
| `purchase_orders` | idem | ⚠️ | Idem |
| `purchase_order_items` | tenant-scope via parent-PO, **geen rol-check** | ⚠️ | Idem |
| `product_bundles` | tenant-scope `public`, **geen rol-check** | ⚠️ | Write → `['tenant_admin','staff']` |
| `product_bundle_items` | parent-product tenant-scope + anon-read | ⚠️ | Idem |
| `bundle_products` (legacy?) | parent-bundle tenant-scope | ⚠️ | Status checken (§8.7) |
| `customer_group_product_prices` | rol-aware `tenant_admin`+`staff`+`marketing` | ✅ | OK |
| `inventory_sync_log` | tenant-scope SELECT, service-role insert | ✅ | OK — audit |
| `external_reviews` (UGC) | tenant-scope, **geen rol-check**; public-read visible=true | ⚠️ | Moderatie → `['tenant_admin','staff','marketing']` |
| `content_translations` | tenant-scope ALL, **geen rol-check** | ⚠️ | Write → `['tenant_admin','staff','marketing']` |
| `translation_jobs` | tenant-scope | ⚠️ | Idem |
| `translation_settings` | tenant-scope | ⚠️ | Write → `['tenant_admin','staff']` |

---

## 2. Gevoeligheidsclassificatie

- **PII:** geen (reviews bevatten klant-naam, maar publiek door klant zelf).
- **Fiscaal/financieel:** `products.cost_price`, `product_variants.cost_price`,
  `product_suppliers.cost_price`/`supplier_sku`, `suppliers.*`, `purchase_orders.*`,
  `purchase_order_items.*`, `supplier_documents.*`.
- **Marketing-faced:** `categories`, `product_categories`, `external_reviews`,
  `content_translations`, `product_bundles`.
- **Operationeel (warehouse):** stock-velden op `products` + `product_variants`
  (geen aparte tabel — zie §6.4).

---

## 3. Edge functions — sweep & classificatie

### 3a. Admin-triggered (JWT-pad) — `requireRole` toevoegen

| Functie | Huidige auth | Voorgestelde `requireRole` |
|---|---|---|
| `create-shopify-product` / `create-odoo-product` / `create-woocommerce-product` | `authenticateRequest(req, tenant_id)` | `['tenant_admin','staff']` |
| `update-shopify-product` / `update-odoo-product` / `update-woocommerce-product` | idem | `['tenant_admin','staff']` |
| `ai-product-promo-kit` | `authenticateRequest(req, tenantId)` | `['tenant_admin','staff','marketing']` |
| `ai-product-field-assistant` | userRole-lookup zelfgebouwd (legacy) | hardenen via `authenticateRequest` + `requireRole(['tenant_admin','staff','marketing'])` |
| `ai-optimize-marketplace-content` | `authenticateRequest(req)` zonder tenant | tenant_id uit body extracten, dan `requireRole(['tenant_admin','staff','marketing'])` |
| `ai-translate-content` | `authenticateRequest(req, tenantId)` | `['tenant_admin','staff','marketing']` |
| `ai-generate-image` | **geen JWT-check** | toevoegen → `['tenant_admin','staff','marketing']` |
| `sync-platform-reviews` | `authenticateRequest(req, tenant_id)` | `['tenant_admin','staff','marketing']` |
| `search-ebay-categories` | te controleren | `['tenant_admin','staff']` |
| `export-q-bundle` | te controleren | `['tenant_admin','staff']` |

### 3b. Cron / webhook — service-role, **niet aanraken**

`sync-bol-inventory`, `sync-bol-orders`, `sync-shopify-inventory`,
`sync-shopify-products`, `sync-woocommerce-products`, `sync-woocommerce-inventory`,
`sync-amazon-inventory`, `sync-ebay-inventory`, `sync-odoo-inventory`,
`ads-inventory-watch`. Verifieer dat tenant-id uit `connection`-record komt (OK in sweep).

### 3c. Storefront-read pad

`storefront-api`, `storefront-resolve` — service-role read; niet aanraken.

---

## 4. Voorgesteld policy-patroon (voor 2C1a)

**Cluster A — Product core:** `products`, `product_variants`, `product_variant_options`
→ behouden zoals nu. Geen wijziging.

**Cluster B — Product meta:** `product_files`, `product_specifications`,
`product_custom_specs`, `product_channel_warnings`, `product_categories`
- SELECT: tenant-scope alle rollen
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff'])`
- Uitzondering `product_categories` write: `['tenant_admin','staff','marketing']`

**Cluster C — Categories (marketing erbij):** `categories`
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','staff','marketing'])`
- DELETE: `has_tenant_role(['tenant_admin'])`

**Cluster D — Bundles:** `product_bundles`, `product_bundle_items`, `bundle_products`
- SELECT: tenant-scope alle rollen + anon op actieve
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff'])`

**Cluster E — Suppliers / Purchasing (fiscaal):** `suppliers`, `supplier_documents`,
`purchase_orders`, `purchase_order_items`, `product_suppliers`
- SELECT: `has_tenant_role(['tenant_admin','staff','accountant','warehouse'])`
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','staff','accountant'])`
- DELETE: `has_tenant_role(['tenant_admin'])`
- Warehouse-uitzondering: UPDATE op `purchase_order_items.received_qty` (§8.5)

**Cluster F — UGC reviews:** `external_reviews`
- public SELECT (visible=true) behouden; service-role INSERT (storefront-pad) behouden
- Auth UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff','marketing'])`
- **Geen** anon-INSERT-policy (§8.6)

**Cluster G — Translations:** `content_translations`, `translation_jobs`,
`translation_settings`
- SELECT: tenant-scope alle rollen
- INSERT/UPDATE/DELETE: `['tenant_admin','staff','marketing']`
  (`translation_settings` write: `['tenant_admin','staff']`)

**Cluster H — Inventory (kritisch):** geen aparte tabel. Warehouse mag nu **niet** stock
muteren omdat UPDATE op `products` `tenant_admin`+`staff` vereist.
- Voorstel 2C1a: aparte UPDATE-policy "warehouse mag products/variants updaten",
  frontend (H4) beperkt zicht tot stock-velden.
- Lange termijn: aparte `stock_movements`-tabel met trigger → batch 2C1d.

---

## 5. Edge-function role-checks (samenvatting voor 2C1b)

Zie §3a. Geen wijziging aan cron/webhook (3b) of storefront-read (3c).

---

## 6. Risico-analyse

1. **Storefront product-reads:** anon-policy op `products` actief → blijft werken. ✅
2. **Marketplace sync:** service-role, `connection.tenant_id`-gefilterd. ✅
3. **`cost_price` lekt:** alle tenant-rollen lezen `products.*` inclusief `cost_price`.
   Bestaande lek, **niet opgelost in 2C1a** (vereist column-grants of view). Open punt
   voor 2C1d.
4. **Warehouse stock-mutaties:** vereist policy-uitbreiding (§4 cluster H). Anders
   blokkeert 2C1a het warehouse-werk.
5. **Marketing zag tot nu toe suppliers/PO's:** aanscherping sluit deze lek. ✅
6. **Admin-UI 403 na aanscherping:** `src/pages/admin/Suppliers.tsx`,
   `useSuppliers`, `useProductSuppliers`, `usePurchaseOrders` zullen voor
   marketing/viewer 403 geven → frontend gating in H4 om routes te verbergen.

---

## 7. Sub-volgorde voor 2C1

- **2C1a — Tabellen-RLS, gesplitst in 3 migrations**
  1. `2c1a-i_product_meta.sql` — Cluster B + C + D
  2. `2c1a-ii_suppliers_purchasing.sql` — Cluster E
  3. `2c1a-iii_ugc_translations_inventory.sql` — Cluster F + G + H
- **2C1b — Edge-function role-checks** (§3a)
- **2C1c — Frontend gating** in H4
- **2C1d (later)** — `cost_price` masking via view + dedicated `stock_movements`-tabel

---

## 8. Open beslispunten

1. **Warehouse mag `cost_price` zien?** Voorstel: **nee**. Vereist column-masking
   (parkeren in 2C1d). 2C1a accepteert bestaande lek.
2. **Marketing mag `suppliers`/`product_suppliers` zien?** Voorstel: **nee**.
3. **Staff mag stock verlagen?** Voorstel: **ja** (al UPDATE op products).
4. **Warehouse mag stock muteren via `products`/`product_variants` UPDATE?**
   Voorstel: **ja**, met aparte UPDATE-policy + frontend-gating.
5. **Warehouse mag `purchase_orders` ontvangst boeken (UPDATE)?**
   Voorstel: **ja**, alleen UPDATE; INSERT/DELETE blijven admin/staff/accountant.
6. **Anon-INSERT op `external_reviews`?** Voorstel: **nee**, via edge function met
   rate-limit + spam-check.
7. **`bundle_products` legacy?** Onderzoeken vóór 2C1a-i (eventueel deprecaten later).
   Voor 2C1a: behandelen als actief.
8. **`product_translations` bestaat niet** → werk in `content_translations`.
9. **`ai-product-description-generator`/`ai-tag-suggester` bestaan niet** →
   role-checks toepassen op `ai-product-field-assistant` + `ai-product-promo-kit`.
10. **`product_costs` als aparte tabel** — bestaat niet; geen aparte RLS nodig.
11. **`stock_adjustments`-tabel** — bestaat niet; out-of-scope voor 2C1.

---

## 9. Bevestigingsverzoek

Bevestig (of corrigeer) §8 punten 1-11 vóór ik 2C1a-migrations schrijf. Met name:
- Warehouse mag `products`/`product_variants` UPDATEN (cluster H optie 1)?
- Warehouse mag `purchase_orders` UPDATEN (ontvangst)?
- `bundle_products`-status onderzoeken nu of later?
- `cost_price` masking parkeren in 2C1d (latere batch)?

Na bevestiging volgt 2C1a in 3 splits-migrations zoals §7.

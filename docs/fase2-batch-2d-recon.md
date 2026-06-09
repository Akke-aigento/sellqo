# Fase 2 — Batch 2D Recon: Reports & Settings

Datum: 2026-06-09
Scope: §3.7 masterplan — alle rapportage- en configuratie-tabellen die niet door 2A-2C zijn gedekt, plus platform-billing als sub-cluster.

## 1. Tabel-inventaris (bestaand vs. niet-bestaand)

### 1a. Bestaand in public-schema

| Sub-cluster | Tabel | Bestaand |
|---|---|---|
| Reports — VAT | `vat_rates` | ✅ |
| Reports — VAT | `vat_regimes` | ✅ (global lookup) |
| Reports — VAT | `vat_report_cache` | ✅ |
| Reports — VAT | `vat_returns` | ✅ |
| Reports — VAT | `vat_validations` | ✅ (VIES validatie) |
| Settings — algemeen | `tenants` (105 cols) | ✅ — bevat business-info kolommen |
| Settings — notif | `tenant_notification_settings` | ✅ |
| Settings — odoo | `tenant_odoo_settings` | ✅ |
| Settings — returns | `tenant_return_settings` | ✅ |
| Settings — theme/branding | `tenant_theme_settings`, `tenant_theme_presets` | ✅ |
| Settings — tracking | `tenant_tracking_settings` | ✅ |
| Settings — i18n | `translation_settings` | ✅ |
| Settings — newsletter | `tenant_newsletter_config` | ✅ |
| Settings — shipping | `shipping_methods`, `shipping_integrations` | ✅ |
| Settings — OAuth | `tenant_oauth_credentials` | ✅ |
| Settings — feature flags | `tenant_feature_overrides` | ✅ (platform-only) |
| Platform-billing | `platform_invoices` | ✅ |
| Platform-billing | `platform_settings` | ✅ |
| Platform-billing | `platform_changelogs`, `platform_incidents`, `platform_health_metrics`, `platform_quick_actions` | ✅ |
| Platform-billing | `platform_coupons`, `platform_coupon_redemptions` | ✅ |
| Platform-billing | `pending_platform_payments` | ✅ |
| Platform-billing | `pricing_plans` | ✅ |
| Platform-billing | `tenant_subscriptions`, `subscriptions`, `subscription_invoices`, `subscription_lines`, `subscription_notifications` | ✅ |
| Platform-billing | `tenant_addons`, `tenant_ai_credits`, `tenant_transaction_usage` | ✅ |

### 1b. NIET bestaand (masterplan-namen die niet voorkomen)

- `vat_reports` / `btw_aangiften` → vervangen door **`vat_returns` + `vat_report_cache`** (canonical = `vat-report-engine` op runtime, cache als materialized)
- `vat_report_lines` / `btw_lines` → niet aanwezig; lines worden runtime gegenereerd uit `invoice_lines` door engine
- `vat_reconciliation_log` → niet aanwezig (engine retourneert `stripe_reconciliation` payload)
- `oss_reports` → niet aanwezig (OSS is een view binnen `vat-report-engine` payload: `oss_by_country`)
- `intervat_xml_exports` → niet aanwezig (XML wordt on-demand gegenereerd; geen persistente export-tabel)
- `q_pakket_bundles` / `q_pakket_files` → niet aanwezig (bundle gegenereerd in `export-q-bundle` als ZIP, niet bewaard)
- `financial_reports`, `operations_reports`, `sales_reports`, `revenue_reports`, `margin_reports` → niet aanwezig (allemaal runtime-queries via `useReports`/`useReportExports`)
- `dashboard_kpi_snapshots` → niet aanwezig (live queries)
- `export_jobs` → niet aanwezig (synchroon, geen async pipeline)
- `tenant_settings` als losse tabel → niet aanwezig; instellingen verspreid over `tenants` (kolommen) + `tenant_*_settings`-tabellen
- `tenant_branding` → consolidatie binnen `tenant_theme_settings` + kolommen op `tenants`
- `tenant_business_info` → kolommen op **`tenants`** (vat_number, kbo, iban, bic, address)
- `tenant_locales`, `tenant_currencies` → kolommen op `tenants`
- `tenant_email_branding`, `tenant_email_footer` → kolommen op `tenants` of `tenant_theme_settings`
- `tenant_invoice_settings` → kolommen op `tenants` (invoice_number_prefix etc.)
- `tenant_shipping_zones`, `tenant_shipping_rates` → vervangen door **`shipping_methods`**
- `tenant_tax_zones`, `tenant_vat_rates` → vervangen door **`vat_rates`**
- `tenant_payment_terms` → kolom op `tenants` of `customers`, geen losse tabel
- `platform_subscriptions` → **`tenant_subscriptions`**
- `platform_usage_metrics` → **`tenant_transaction_usage`** + **`platform_health_metrics`**
- `platform_billing_settings` → **`platform_settings`**
- `platform_payment_methods` → niet aanwezig (Stripe Connect; geen DB-tabel)
- `platform_credit_notes` → niet aanwezig
- `platform_discount_codes` → **`platform_coupons`**

**Conclusie:** veel masterplan-namen zijn aliassen voor bestaande tabellen of zijn runtime-only. Recon werkt vanaf bestaande namen.

## 2. RLS-classificatie per tabel

Legenda: ✅ rol-aware (write gated op `has_tenant_role` / `is_platform_admin`)  · ⚠️ tenant-blind (alleen `tenant_id IN get_user_tenant_ids` zonder rol-check) · ❌ unbounded (`true` / breed open) · 🔒 platform-only

### 2a. Reports — fiscaal/VAT

| Tabel | SELECT | INSERT | UPDATE | DELETE | Verdict |
|---|---|---|---|---|---|
| `vat_rates` | tenant-scope of global (NULL) | tenant_admin | tenant_admin | tenant_admin | ✅ — al rol-aware, accountant ontbreekt op write |
| `vat_regimes` | `true` (global lookup) | — | — | — | ✅ (publieke lookup) |
| `vat_report_cache` | tenant-scope | geen policy (service-role only) | — | — | ⚠️ — geen rol-check op SELECT (any tenant member kan cache lezen, ok), service-role-write impliciet |
| `vat_returns` | tenant-blind ALL (`tenant_id IN ...`) | idem | idem | idem | ⚠️ — viewer/marketing kan VAT-aangiften lezen, viewer kan ze ook **muteren**. Fiscaal lek. |
| `vat_validations` | tenant-scope SELECT + platform_admin SELECT; INSERT `with_check` ontbreekt feitelijk (twee INSERT-policies zonder `with_check`) | open | — | — | ❌ — INSERT-policies zonder `with_check` clause = iedere geauth'de user kan rows voor willekeurige tenant invoegen. **Hard lek.** |

### 2b. Settings — algemeen / branding / config

| Tabel | SELECT | INSERT | UPDATE | DELETE | Verdict |
|---|---|---|---|---|---|
| `tenants` | eigen tenant of platform | self-insert + platform | tenant_admin of platform | platform | ✅ — fiscaal-sensitive cols (vat_number/iban/kbo/bic) niet apart gated; accountant heeft GEEN write |
| `tenant_notification_settings` | members + platform | tenant_admin | tenant_admin | tenant_admin | ✅ |
| `tenant_odoo_settings` | members + platform | tenant_admin+accountant | idem | idem | ✅ — al accountant-rol toegevoegd |
| `tenant_theme_settings` | members + platform | tenant_admin | tenant_admin | tenant_admin | ✅ |
| `tenant_tracking_settings` | members | tenant_admin (ALL-policy) | idem | idem | ✅ |
| `tenant_return_settings` | tenant-blind ALL | idem | idem | idem | ⚠️ — viewer kan return-policies muteren |
| `translation_settings` | tenant-blind ALL + tenant-blind SELECT | idem | idem | idem | ⚠️ — viewer write mogelijk |
| `tenant_newsletter_config` | members | tenant_admin | tenant_admin | tenant_admin | ✅ |
| `tenant_oauth_credentials` | tenant_admin only (geen SELECT voor anderen) | tenant_admin | tenant_admin | tenant_admin | ✅ (correct strict — secrets) |
| `shipping_methods` | members + platform | admin+staff | admin+staff | tenant_admin | ✅ |
| `shipping_integrations` | members | tenant_admin | tenant_admin | tenant_admin | ✅ |
| `tenant_feature_overrides` | platform-only ALL | platform | platform | platform | 🔒 ✅ |

### 2c. Platform-billing (strict isolation vereist)

| Tabel | SELECT | Write | Verdict |
|---|---|---|---|
| `platform_invoices` | **tenants kunnen eigen invoices zien** + platform ALL | platform | ⚠️ — bewust dat tenant_admin invoices kan lezen (zelfservice billing-UI); masterplan eist HARDE nee. Beslispunt. |
| `platform_settings` | platform SELECT + platform UPDATE | platform | 🔒 ✅ |
| `platform_changelogs` | platform ALL (geen public SELECT) | platform | ⚠️ — als changelogs publiek getoond moeten worden in admin-UI, mist tenant SELECT |
| `platform_incidents`, `platform_health_metrics`, `platform_quick_actions` | platform-only | platform | 🔒 ✅ |
| `platform_coupons`, `platform_coupon_redemptions` | platform-only | platform | 🔒 ✅ |
| `pending_platform_payments` | platform ALL + tenants eigen rijen SELECT | platform | ✅ (zelfservice "wat staat open") |
| `pricing_plans` | publiek SELECT (active=true) + platform ALL | platform | ✅ (publieke prijslijst) |
| `tenant_subscriptions` | (niet in dump — check) | | te verifiëren |
| `subscriptions` | tenant-blind ALL | tenant-blind ALL | ⚠️ — viewer kan SaaS-abonnement annuleren. **Lek.** |
| `subscription_invoices` | tenant-blind via subscription join | idem | ⚠️ — idem |
| `tenant_addons` | tenant SELECT only (geen write-policy zichtbaar → service-role) | service-role | ✅ |
| `tenant_ai_credits` | members SELECT + members UPDATE | tenant-blind UPDATE | ⚠️ — viewer kan credits muteren (al gerapporteerd in 2A) |
| `tenant_transaction_usage` | (niet in dump) | | te verifiëren |

## 3. Kolom-classificatie (fiscaal-sensitive vs operational)

- **`tenants`** (single mega-table — H3 split later):
  - Fiscaal: `vat_number`, `kbo_number`, `iban`, `bic`, `legal_name`, `billing_address_*`, `vat_regime_default`
  - Branding/operational: `name`, `logo_url`, `primary_color`, `email_*`, `social_*`
  - Platform-billing-ref: `stripe_account_id`, `stripe_customer_id`, `plan_id`, `trial_ends_at`
  - Aanbeveling: tenant_admin+accountant op fiscaal-block; tenant_admin only op branding; platform_admin only op platform-billing-ref (UPDATE column-level via trigger of dedicated RPC).
- **`vat_returns`**: alle cols fiscaal-sensitive (boxes, totals, declaration_period).
- **`vat_rates`**: `rate`, `regime_code`, `gl_account_code` = fiscaal; `display_name`, `is_default` = operational.
- **`shipping_methods`**: operational.
- **`tenant_oauth_credentials`**: secrets — al correct strict.
- **`platform_invoices`**: `stripe_invoice_id`, `pdf_url`, `total_amount` — tenant mag lezen (zelfservice) maar nooit muteren.

## 4. Edge-function auth-pad

| Functie | `verify_jwt` | In-code auth | Rol-check | Status |
|---|---|---|---|---|
| `vat-report-engine` | default (true) | `authenticateRequest(req, tenant_id)` | geen | ⚠️ — viewer kan VAT-rapport draaien |
| `export-vat-xlsx` | default | `authenticateRequest` | geen | ⚠️ |
| `export-vat-pdf` | default | `authenticateRequest` | geen | ⚠️ |
| `export-vat-xml` | default | `authenticateRequest` | geen | ⚠️ |
| `export-ic-listing-xml` | default | `authenticateRequest` | geen | ⚠️ |
| `export-q-bundle` | default | `authenticateRequest` | geen | ⚠️ |
| `export-odoo-csv` | default | `authenticateRequest` | geen | ⚠️ |
| `resolve-vat-regime` | default | `authenticateRequest` (try/catch) | geen | ✅ acceptabel (read-only helper) |
| `validate-vat` | **false** | geen | n.v.t. | ⚠️ — open VIES proxy; rate-limit? |
| `warmup-vat-cache` | **false** | `authenticateRequest(req)` zonder tenant | service/cron | ✅ als cron |
| `regression-test-vat` | **false** | `authenticateRequest(req, tenant_id)` | geen | ⚠️ — dev-tool, zou platform_admin moeten zijn |
| `backfill-vat-regimes` | default | `authenticateRequest` | geen | ⚠️ — destructieve migratie; platform_admin/service-role only |
| `platform-gift-month` | **false** | inline `supabase.auth.getUser` | geen `is_platform_admin` check | ❌ — **kritiek lek**: iedere geauth'de user kan zichzelf een gratis maand geven. Moet platform_admin only. |
| `sync-vat-rates` | — | functie bestaat niet in repo | — | masterplan-naam; lookup `vat_rates` is statisch global |
| `ads-bolcom-reports` | (operations) | | | buiten dit cluster |

## 5. Voorgesteld policy-patroon (samenvatting per sub-cluster)

### 5a. Reports — fiscaal (vat_returns, vat_report_cache, vat_validations, vat_rates)
- SELECT (auth): `has_tenant_role(tenant_id, ['tenant_admin','staff','accountant'])` + platform-admin bypass
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','accountant'])`
- DELETE: `has_tenant_role(['tenant_admin','accountant'])` — beslispunt OB1
- viewer/marketing/warehouse: **geen toegang** tot vat_returns/cache (fiscaal); wel `vat_rates` SELECT voor storefront-prijzen (via service-role pad of global rows met `tenant_id IS NULL`).
- `vat_validations` INSERT: **fix nu** — voeg `with_check (tenant_id IN get_user_tenant_ids ...)` toe.
- Service-role ALL (engine pad).

### 5b. Reports — sales/operations/dashboards
- Geen aparte tabellen; allemaal runtime-queries op `orders`/`invoices`/`products`. Gating gebeurt via die brontabellen (2A/2B).
- Edge-function gating volstaat (sectie 6).

### 5c. Settings — algemeen + branding + email
- SELECT (auth): alle tenant-members + platform
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin'])`
- Reeds correct voor: `tenant_notification_settings`, `tenant_theme_settings`, `tenant_newsletter_config`, `tenant_oauth_credentials`, `shipping_integrations`, `tenant_tracking_settings`.
- **Te fixen**: `tenant_return_settings`, `translation_settings` (tenant-blind ALL → rol-aware split).

### 5d. Settings — fiscaal/business-info (op `tenants`)
- Geen losse tabel; column-level gating via trigger of split-tabel `tenant_business_info` (volgt in H3 schema-refactor).
- Interim: RLS UPDATE-policy op `tenants` toevoegen: `tenant_admin` voor branding-cols, `tenant_admin+accountant` voor fiscaal-cols. Beslispunt OB6.

### 5e. Settings — shipping_methods + vat_rates (storefront-relevant)
- SELECT (auth): alle tenant-members (transparantie productprijzen). ✅ al zo.
- Storefront leest via service-role (storefront-resolve edge functions) — pad behouden, geen RLS-change nodig.
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','accountant'])` — voeg accountant toe voor `vat_rates`.
- DELETE: `has_tenant_role(['tenant_admin'])`.

### 5f. Platform-billing (strikt)
- ALL: `is_platform_admin(auth.uid())` only
- Service-role ALL voor billing-runner (Stripe webhooks)
- **Beslispunt OB2**: huidige `platform_invoices` SELECT laat tenant eigen invoices zien (zelfservice billing-UI). Masterplan eist "HARD nee" — conflict met UX. Aanbeveling: **behoud tenant SELECT** voor `platform_invoices` + `pending_platform_payments`, gating UI op tenant_admin only via `<RouteGuard>` + edge-function rol-check.
- `subscriptions`/`subscription_invoices` — voor SaaS-billing zelfservice — moet tenant_admin only voor write, tenant_admin+accountant SELECT.
- `tenant_feature_overrides`: 🔒 al correct.

## 6. Edge-function rol-check uitrol

| Functie | Voorgestelde `requireRole` |
|---|---|
| `vat-report-engine` | `['tenant_admin','accountant','staff']` (SELECT-equiv) |
| `export-vat-xlsx`, `-pdf`, `-xml` | `['tenant_admin','accountant']` |
| `export-ic-listing-xml` | `['tenant_admin','accountant']` |
| `export-q-bundle` | `['tenant_admin','accountant']` |
| `export-odoo-csv` | `['tenant_admin','accountant']` |
| `resolve-vat-regime` | geen (read-only helper, blijft auth-only) |
| `validate-vat` | activeer `verify_jwt`; rate-limit; eventueel `requireRole(['tenant_admin','accountant','staff'])` |
| `warmup-vat-cache` | service-role check (cron pad) |
| `regression-test-vat` | `is_platform_admin` only |
| `backfill-vat-regimes` | `is_platform_admin` only |
| `platform-gift-month` | **FIX NU** — `is_platform_admin` check toevoegen (kritiek lek) |

## 7. Risico-analyse

- **Storefront leest `shipping_methods` + `vat_rates`**: via service-role in `storefront-resolve` / `checkout-engine`. Geen impact bij rol-check tightening.
- **`/admin/billing` route**: bestaat als `Subscriptions.tsx`-pagina (tenant-self-service). Toont `tenant_subscriptions` + `platform_invoices`. Houdt tenant SELECT-policy op `platform_invoices`. Voor SellQo-overzicht (alle invoices alle tenants) is `usePlatformBilling` reeds gated op `isPlatformAdmin`.
- **`/admin/settings/business`**: pagina bestaat niet als losse route; business-info-velden in `Settings.tsx` op `tenants`. Bij introductie split-tabel `tenant_business_info` → accountant+admin RW gating.
- **Viewer kan momenteel**: VAT-aangifte maken/wijzigen (`vat_returns` tenant-blind), SaaS-abonnement opzeggen (`subscriptions` tenant-blind), AI-credits muteren (`tenant_ai_credits`), VAT-validaties faken (`vat_validations` zonder `with_check`). 4 lekken voor 2D-fix.
- **`platform-gift-month`** krijgt **prioriteit** — nu kan elke geauth'de user maanden geven. Quick-fix vóór 2D zelfs.

## 8. Open beslispunten

| ID | Vraag | Voorstel |
|---|---|---|
| OB1 | VAT_returns DELETE: alleen tenant_admin of ook accountant? | **Beide** (accountant is fiscaal verantwoordelijk) |
| OB2 | Platform_invoices tenant SELECT toestaan (zelfservice) of HARD nee? | **Toestaan** — UX-noodzaak; gating via UI + `tenant_admin` rol |
| OB3 | Viewer + marketing → `vat_rates` SELECT? | **Ja** (transparantie product-prijzen) |
| OB4 | Viewer → `shipping_methods` SELECT? | **Ja** (al zo, behouden) |
| OB5 | Operations-reports → viewer SELECT? | **Ja** (dashboards) — geen tabel, gating op edge-fn |
| OB6 | Accountant write op `tenants.vat_number/iban/kbo`? | **Ja** (column-level via trigger of split-tabel) |
| OB7 | Q-bundle SELECT/run: accountant + tenant_admin only? | **Ja**, staff niet |
| OB8 | `validate-vat` openhouden (`verify_jwt=false`) of dichtzetten? | **Dichtzetten** + rate-limit |
| OB9 | `subscriptions` (SaaS) write: tenant_admin only? | **Ja** — viewer mag SaaS-abonnement niet annuleren |
| OB10 | `tenant_business_info` als split-tabel introduceren (H3) of column-policies op `tenants`? | **H3 split** — schoner; interim column-policies |

## 9. Voorgestelde sub-volgorde 2D

- **2D-pre** (urgent quick-fix, vóór 2D zelf):
  - `platform-gift-month` → `is_platform_admin` check
  - `vat_validations` INSERT-policies → `with_check` clause toevoegen
- **2D-i — Reports/VAT cluster** (RLS + edge-fn rol-check):
  - `vat_returns`, `vat_report_cache`, `vat_validations`, `vat_rates` rol-aware
  - Edge-fns: `vat-report-engine`, `export-vat-*`, `export-ic-listing-xml`, `export-q-bundle`, `export-odoo-csv`
- **2D-ii — Settings cluster**:
  - `tenant_return_settings`, `translation_settings` rol-aware
  - `tenants` UPDATE column-policy (fiscaal vs branding) — interim
- **2D-iii — Platform-billing lockdown**:
  - `subscriptions`, `subscription_invoices`, `subscription_lines`, `subscription_notifications` rol-aware
  - Bevestig `tenant_subscriptions` policies (verifiëren)
  - `platform_invoices` tenant SELECT behouden (OB2), `tenant_admin` rol-check op write-RPC
- **2D-iv — Edge-function role-checks** (cluster-overstijgend):
  - `regression-test-vat`, `backfill-vat-regimes` → `is_platform_admin`
  - `validate-vat` → `verify_jwt=true` + rol-check
  - Alle export-functies → `requireRole(['tenant_admin','accountant'])`

## 10. Open vragen aan gebruiker

- Bevestig OB1-OB10 hierboven.
- Bevestig dat `platform-gift-month` quick-fix vóór formele 2D mag gebeuren (security-noodzaak).
- Bevestig pad voor `tenants` column-level fiscaal-gating: trigger (interim) of `tenant_business_info` split-tabel (H3).

— Einde recon 2D
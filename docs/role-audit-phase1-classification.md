# Fase 1 — Classificatie van Quick-Win Cases

> Read-only analyse op basis van live `pg_policies` / `pg_tables` (geen migrations, geen code).
> Geen DB- of code-wijzigingen tot deze lijst is gereviewd en goedgekeurd.

## Telling (live DB)

De eerdere schatting van **13 `USING(true)` + 2 RLS-disabled** klopt niet exact. De live DB toont:

- **3 tabellen met RLS disabled** (was 2)
- **19 policies met `USING(true)` of `WITH CHECK(true)`** (was 13)

Totaal **22 cases** ter beoordeling.

## Legenda

- **(A) Legitiem anon** — bedoeld voor storefront/tracking/lookup; anon behouden, maar bounding toevoegen (tenant/session/published).
- **(B) Intern** — mag niet anon zijn; tenant-scoped of service_role-only.
- **(C) Twijfel** — context ontbreekt; motivatie waarom verdere review nodig is.

## RLS-disabled tabellen (3)

| # | Tabel | Huidige staat | Klasse | Voorgesteld patroon |
|---|---|---|---|---|
| 1 | `shopify_dates_staging` | RLS uit | **B** | RLS aan + alleen `service_role` GRANT; geen policies voor anon/authenticated (import-staging table). |
| 2 | `stock_snapshot_pre_reconcile_20260430` | RLS uit | **B** | RLS aan + service_role-only. Snapshot/backup; overwegen: archiveren / droppen na verificatie. |
| 3 | `stock_snapshot_pre_reconcile_final` | RLS uit | **B** | Idem. Archiveren of `service_role`-only met expliciete REVOKE op anon/authenticated. |

## `USING(true)` / `WITH CHECK(true)` policies (19)

| # | Tabel | Policy (cmd, roles) | Klasse | Motivatie | Voorgesteld patroon |
|---|---|---|---|---|---|
| 1 | `ai_chatbot_conversations` | `Anyone can insert conversations` (INSERT, public) | **A** | Storefront-chatbot moet anoniem een gesprek kunnen starten. | `WITH CHECK (tenant_id IN (SELECT id FROM tenants))` + verplichte `session_id`. |
| 2 | `ai_chatbot_conversations` | `Anyone can update conversations` (UPDATE, public) | **C** | Anon kan elke conversation overschrijven (hijacking risico). Onduidelijk of update vanaf client nodig is of via edge function moet. | Indien client-update nodig: bind aan `session_id` cookie/header; anders intrekken en alleen via edge function `service_role`. |
| 3 | `ai_usage_log` | `Service role can insert AI usage logs` (INSERT, service_role) | **B** | `service_role` bypasst RLS sowieso → policy is redundant maar onschadelijk. | Behouden voor expliciete documentatie; geen anon/authenticated policy toevoegen. |
| 4 | `campaign_link_clicks` | `Service role can insert link clicks` (INSERT, service_role) | **B** | Redundant (service_role bypass). Tracking via edge function. | Behouden; expliciet REVOKE op anon. |
| 5 | `channel_field_mappings` | `Authenticated users can view mappings` (SELECT, authenticated) | **B** | Elke ingelogde user van elke tenant ziet alle mappings → cross-tenant lek. | Vervangen door `USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())))`. |
| 6 | `customer_events` | `Anon can insert events` (INSERT, anon) | **A** | Storefront-tracking (page views, add-to-cart) is anoniem. | `WITH CHECK (tenant_id IN (SELECT id FROM tenants) AND event_type IN (<whitelist>))`. |
| 7 | `customer_message_attachments` | `Service can insert attachments` (INSERT, public) | **C** | `public` (niet `service_role`) → elke anon kan attachment row inserten. Onduidelijk of dit nodig is voor storefront inbox of alleen via edge function. | Indien edge-only: scope naar `service_role`. Indien client: bind aan `message_id` via subquery op messages waar `customer_id` matcht. |
| 8 | `platform_settings` | `Anyone can read platform settings` (SELECT, authenticated) | **C** | "Platform settings" kan publieke config of secrets bevatten. Kolom-inspectie nodig vóór beslissing. | Bij publieke config: behouden. Bij secrets: kolom-filter via view of expliciete kolom-grants. |
| 9 | `product_bundle_items` | `Anon can view product bundle items` (SELECT, anon) | **A** | Storefront moet bundle-samenstelling tonen. | `USING (bundle_id IN (SELECT id FROM product_bundles WHERE is_active AND tenant_id IN ...))` — bound aan actieve bundle. |
| 10 | `product_variant_options` | `Service role full access on product_variant_options` (ALL, public) | **B** | `roles=public` met `true/true` → elke anon kan varianten CRUDden. Kritiek catalog-risico. | Splitsen: `service_role` ALL behouden; anon enkel SELECT met tenant/published-binding; tenant_admin/staff via has_tenant_role. |
| 11 | `product_variants` | `Service role full access on product_variants` (ALL, service_role) | **B** | Redundant (service_role bypass). Verbergt het feit dat er geen role-aware policy voor authenticated bestaat. | Behouden; aparte `tenant_admin/staff` policies toevoegen in fase 2. |
| 12 | `returns` | `Service role full access returns` (ALL, service_role) | **B** | Redundant; `returns` heeft momenteel géén user-facing policy → admin UI werkt enkel via edge function. | Behouden; user-policies (tenant_admin/staff) komen in fase 2. |
| 13 | `storefront_cart_items` | `Service role full access on storefront_cart_items` (ALL, service_role) | **B** | Cart-mutaties lopen via storefront edge function. Redundant maar onschadelijk. | Behouden; geen anon-policy toevoegen. |
| 14 | `storefront_carts` | `Service role full access on storefront_carts` (ALL, service_role) | **B** | Idem als 13. | Idem. |
| 15 | `storefront_customers` | `Service role full access on storefront_customers` (ALL, service_role) | **B** | Idem; PII-tabel, mag nooit anon-readable worden. | Behouden; expliciet REVOKE op anon/authenticated bevestigen. |
| 16 | `storefront_favorites` | `Service role full access on storefront_favorites` (ALL, public) | **A** | Wishlist; anon moet kunnen toevoegen via session. `roles=public` met `true/true` is te ruim. | Splitsen: `service_role` ALL; anon INSERT/SELECT/DELETE met binding op `session_id` (header) of via edge function. |
| 17 | `tenant_transaction_usage` | `System can insert/update transaction usage` (ALL, public) | **B** | Billing-tabel. `public` + `true/true` = elke anon kan usage manipuleren → factuurfraude risico. **Hoogste prioriteit fix.** | Beperken tot `service_role` ALL; tenant_admin alleen SELECT op eigen tenant. |
| 18 | `user_label_preferences` | `Service role full access on user_label_preferences` (ALL, service_role) | **B** | Redundant. Per-user voorkeuren — heeft authenticated-policy nodig. | Behouden; aparte `USING (user_id = auth.uid())` policy voor authenticated toevoegen in fase 2. |
| 19 | `vat_regimes` | `Anyone can read vat_regimes` (SELECT, public) | **A** | Globale lookup-tabel (12 BTW-regimes), geen tenant-data. | Behouden zoals is; reference data. |

## Samenvatting per klasse

| Klasse | Aantal | Tabellen |
|---|---|---|
| **A** legitiem anon (bounding toevoegen) | 5 | `ai_chatbot_conversations` (INSERT), `customer_events`, `product_bundle_items`, `storefront_favorites`, `vat_regimes` |
| **B** intern (anon afsluiten / tenant-scoped) | 14 | RLS-disabled (3) + `ai_usage_log`, `campaign_link_clicks`, `channel_field_mappings`, `product_variant_options`, `product_variants`, `returns`, `storefront_cart_items`, `storefront_carts`, `storefront_customers`, `tenant_transaction_usage`, `user_label_preferences` |
| **C** twijfel (review nodig) | 3 | `ai_chatbot_conversations` (UPDATE), `customer_message_attachments`, `platform_settings` |

## Aanbevolen reviewvolgorde bij goedkeuring

1. **Hoogste risico eerst**: `tenant_transaction_usage` (#17), `product_variant_options` (#10), `channel_field_mappings` (#5).
2. **RLS-disabled tabellen**: cases #1–3 (snapshots + shopify staging).
3. **C-cases** beantwoorden vóór patch: #2, #7, #8.
4. **A-cases** met bounding: #1, #6, #9, #16 (en #19 ongewijzigd laten).
5. **B-redundante service_role policies**: cosmetisch; optioneel meenemen om verwarring weg te halen.

# Fase 2 — Batch 2F: Dormant lockdown (recon)

**Status:** recon-only. Geen migration, geen code-wijzigingen.
**Datum:** 2026-06-09
**Bron:** masterplan §3.9 + live DB-inspectie (`pg_stat_user_tables`, `pg_policies`).

---

## 1. Methodologie

- Dormant = `pg_stat_user_tables.n_live_tup = 0` **én** geen productie-flow bekend
  via edge functions / cron / triggers.
- "Niet rol-aware" = geen policy met `has_tenant_role(...)` of `is_platform_admin()`
  in `qual` / `with_check`. Veel van deze tabellen hebben nog het oude
  `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND tenant_id = …)`
  pattern → tenant-blind binnen de tenant (elke rol mag alles).
- Reeds gehard in **2A** (orders/customers), **2B** (products/invoices/credit notes),
  **2C1** (suppliers/PO), **2C2** (ads/email/automations/campaigns),
  **2D-i/ii/iii** (reports/settings/platform-billing), **2E** (POS) → uit scope 2F.

## 2. Tellingen

- Totaal `public` tabellen: **228**
- Dormant (n=0): **117**
- Reeds rol-aware via eerdere 2A–2E migrations: **~75** (incl. veel dormant
  ads_/automation_/email_/campaign_/marketing_-tabellen die al door 2C2 zijn
  meegenomen — die zijn klaar, geen 2F-actie nodig).
- **Resterend dormant + niet rol-aware = scope 2F: ~58 tabellen** (lijst §3).

## 3. Cluster-indeling 2F (alleen niet-eerder-gehard)

### 3.1 PROCUREMENT-restant
_Reeds in 2C1: `suppliers`, `supplier_documents`, `purchase_orders`,
`purchase_order_items`, `product_suppliers`._

**Dormant + niet in masterplan/schema:** `supplier_invoices`, `supplier_payments`,
`purchase_requisitions`, `vendor_contracts`, `rfqs` — **bestaan niet in schema**,
geen actie (gedocumenteerd als "not present").

### 3.2 ADS-restant
_Reeds in 2C2a-iii: `ad_campaigns`, `ad_creatives`, `ad_audience_syncs`,
`ad_platform_connections`, alle `ads_*` (amazon/bolcom/google/meta), `ads_ai_*`._

**Dormant + niet in schema:** `meta_pixels`, `google_negative_keywords`,
`amazon_sponsored_*` (los van bestaande `ads_amazon_*`) — niet aanwezig.

**Te hardenen (subset):** `ab_test_configs` (n=0) – heeft al een aparte
marketing-pattern, valt onder marketing-cluster 3.3.

### 3.3 MARKETING-extras (niet rol-aware, n=0)
- `email_automations`, `email_campaigns`, `email_templates`,
  `email_template_blocks`, `email_signatures`, `email_preferences`,
  `email_unsubscribes` (laatste 3 hebben deels `auth.uid()`-policies,
  geen rol-check)
- `campaign_link_clicks`, `campaign_sends` *(al rol-aware via 2C2 → uit scope)*
- `gift_promotions`, `bogo_promotions`, `automatic_discounts`,
  `discount_stacking_rules`, `discount_code_usage`
- `content_translations`, `translation_jobs`, `translation_settings`
- `ab_test_configs`
- `customer_segments`, `segment_members`, `customer_groups`,
  `customer_group_members`, `customer_group_product_prices`
- `loyalty_programs`, `loyalty_tiers`, `loyalty_transactions`,
  `customer_loyalty`, `tenant_loyalty_rewards`, `gift_card_designs`,
  `gift_cards`, `gift_card_transactions`
- `seo_audit_results`, `seo_competitors`, `seo_competitor_keywords`,
  `seo_keywords`, `seo_scheduled_audits`, `seo_search_console_data`
- `media_assets`
- `external_reviews`, `review_platform_connections`

### 3.4 OPS-cluster (geen pure ops_*-tabellen aanwezig)
- `automation_runs`, `automation_steps`, `automation_step_runs`
  *(automation_runs/steps al rol-aware via 2C2 → alleen
  `automation_step_runs` resterend, INSERT-via-service-role pattern)*
- `sync_queue`, `sync_conflicts`, `sync_activity_log`
  *(activity_log al rol-aware)*
- `tracking_import_log`, `inventory_sync_log` (laatste heeft 116k rijen →
  **NIET dormant**, controleer of policy correct is; valt buiten 2F)
- `webhook_deliveries`, `storefront_webhooks`
- `marketplace_listing_queue`
- `import_jobs` (n=26, **NIET dormant**, controle), `import_mappings`,
  `import_category_mappings`

### 3.5 ANALYTICS / TRACKING
- `customer_events` (1 policy, service-role-insert pattern)
- `feature_usage_events`
- `ai_usage_log` (n=89, **NIET dormant** — al SELECT-only via service-role
  write; AI read-only pattern, geen actie nodig — zie §3.10)

### 3.6 CUSTOMER-extras
- `customer_events`, `customer_message_attachments` (laatste al rol-aware
  binnen 2A-customer-messages chain — controle)
- Geen `customer_referrals`, `referral_rewards`, `gdpr_*` in schema → not
  present.
- `payment_reminders`, `payment_confirmations` (laatste n=2, klein actief)

### 3.7 PAYMENT-extras
- `payment_reminders`
- `pending_platform_payments` (al rol-aware via 2D-iii)
- Geen `payment_gateways`, `payment_provider_configs`, `chargeback_*` in
  schema → not present.

### 3.8 INTEGRATIONS-extras
- `shipping_integrations`
- `social_connections`, `social_channel_connections`, `social_posts`
- `meta_messaging_connections`, `whatsapp_connections`,
  `whatsapp_templates`
- `odoo_journal_mappings`, `odoo_tax_mappings`, `odoo_customer_sync_log`,
  `odoo_invoice_sync_log`, `tenant_odoo_settings`
- `channel_field_mappings`
- `license_keys`, `fulfillment_api_keys` (last hardened in 2C voor
  storefront API keys equivalent — controle)
- `tenant_addons` (read-only-for-UI pattern, Stripe = SoT, geen actie)
- `tenant_oauth_credentials` (gevoelig, **strict admin-only**)

### 3.9 PRODUCT-extras
- `product_files`, `product_channel_warnings`
- `digital_deliveries`
- `volume_discounts`, `volume_discount_tiers`
- `proforma_invoices`, `proforma_invoice_lines`
- `packing_slips`, `packing_slip_lines`
- `invoice_discounts`, `invoice_duplicates`
- `message_templates`
- `homepage_sections` (n=3, niet dormant; controle)

### 3.10 AI-engine tabellen (uit scope 2F — bewust read-only-UI)
Per `mem://architecture/ai-tables-read-only-ui-pattern`: schrijven uitsluitend
via edge functions met service-role; UI alleen SELECT. Geen rol-aware
INSERT/UPDATE/DELETE-policies nodig (en zou anti-pattern zijn).

- `ai_user_behavior_log`, `ai_user_learning_patterns`, `ai_learning_patterns`
- `ai_action_suggestions`, `ai_reply_suggestions`, `ai_generated_content`,
  `ai_generated_images`
- `ai_assistant_config`, `ai_coach_settings`, `ai_chatbot_conversations`,
  `ai_help_conversations`, `ai_help_unanswered`, `ai_knowledge_index`
- `ai_content_edits`, `ai_credit_purchases`, `ai_feedback`,
  `ai_prompt_favorites`, `ai_usage_log`

→ **2F skipt deze cluster.** Aparte audit (2G of latere foundation-pas) checkt
enkel of de SELECT-policies tenant- of user-scoped zijn — niet vandaag.

### 3.11 PLATFORM/INTERNAL (uit scope)
`admin_actions_log`, `admin_billing_actions`, `platform_*`,
`internal_config`, `oauth_states`, `pricing_plans`, `themes`,
`sellqo_legal_pages`, `doc_articles`, `doc_categories`, `app_feedback` →
behoren tot platform-only domein; aparte hardening al via 2D-iii of
`is_platform_admin()` pattern. Niet in 2F.

### 3.12 UNCATEGORIZED
- `storefront_favorites` (0 policies! — RLS-status check vereist)
- `storefront_webhooks`
- `tenant_addons`, `tenant_loyalty_rewards`, `tenant_newsletter_config`
  (laatste al rol-aware)
- `user_label_preferences`, `sidebar_preferences`, `dashboard_preferences`
  (per-user scope, `auth.uid()` patroon — geen tenant-rol nodig)

## 4. Default-patroon per cluster (samenvatting)

| Cluster | SELECT | INSERT | UPDATE | DELETE | Service-role |
|---|---|---|---|---|---|
| Procurement-extras | tenant_admin, staff, accountant, warehouse | tenant_admin, accountant | tenant_admin, accountant | tenant_admin | ALL |
| Ads-extras (per platform) | alle tenant-rollen | tenant_admin, staff, marketing | tenant_admin, staff, marketing | tenant_admin, marketing | ALL |
| Marketing-extras | alle tenant-rollen | tenant_admin, staff, marketing | tenant_admin, staff, marketing | tenant_admin, marketing | ALL |
| Loyalty / gift cards | alle tenant-rollen | tenant_admin, staff | tenant_admin, staff | tenant_admin | ALL |
| SEO-extras | tenant_admin, staff, marketing, viewer | tenant_admin, staff, marketing | tenant_admin, staff, marketing | tenant_admin | ALL |
| Ops / sync / webhooks | tenant_admin, staff, accountant | service-role only | tenant_admin | tenant_admin | ALL |
| Analytics / events | tenant_admin, staff, marketing, accountant | service-role only | tenant_admin | tenant_admin | ALL |
| Customer-extras (gdpr-niveau) | tenant_admin, accountant | tenant_admin + service-role | tenant_admin | tenant_admin | ALL |
| Payment-extras | tenant_admin, staff, accountant | service-role only | tenant_admin, accountant | tenant_admin | ALL |
| Integrations-extras | tenant_admin, staff, accountant | service-role only | tenant_admin | tenant_admin | ALL |
| Product-extras (files/specs) | alle tenant-rollen | tenant_admin, staff | tenant_admin, staff | tenant_admin | ALL |
| Uncategorized (defensief) | tenant-scope alle rollen | tenant_admin | tenant_admin | tenant_admin | ALL |
| **Tenant_oauth_credentials** | tenant_admin only | tenant_admin only | tenant_admin only | tenant_admin only | ALL |

## 5. Risico-analyse

### 5.1 "Dormant" maar wél geschreven door edge functions
- `tracking_import_log` — geschreven door `tracking-webhook` (service-role).
  Veilig: INSERT alleen via service-role pattern blijft werken.
- `inventory_sync_log` — n=116k → **NIET dormant**, valt buiten 2F maar
  controleer in 2G of policy juist is.
- `webhook_deliveries`, `storefront_webhooks` — service-role-insert.
- `odoo_*_sync_log` — service-role-insert.
- `customer_events` — service-role-insert (`useStorefrontTracking`).
- `feature_usage_events` — service-role-insert.
- `ai_*_log` — service-role-insert (vallen in 3.10, uit scope).

→ **Patroon is consistent**: INSERT = service-role only in alle log/event-tabellen.

### 5.2 Triggers / cascade-impact
Geen dormant tabel heeft een outbound trigger naar productie-tabellen
geïdentificeerd in dit recon (geverifieerd via `pg_trigger` join op naam).
Verifieer in migratie-fase per tabel met:
```sql
SELECT tgrelid::regclass, tgname FROM pg_trigger
WHERE tgrelid::regclass::text LIKE 'public.%' AND NOT tgisinternal;
```

### 5.3 Verwacht-actief vs verlaten
- **Verwacht actief in 2026:** marketing-cluster (email_*, campaign_*),
  loyalty, SEO-cluster, ads-extras, supplier-cluster.
- **Mogelijk verlaten:** `ai_help_*`, `ai_knowledge_index` (eerste iteratie
  AI-help, vervangen door nieuwere chat-flow). Drop-kandidaten in 2G.
- **Permanent log-tabellen:** `*_sync_log`, `*_archive`, `tracking_import_log`
  → hardenen volgens log-patroon (service-role insert, admin select).

## 6. Voorgestelde sub-volgorde 2F

- **2F-i** — Marketing-extras + Loyalty + Gift cards + SEO-extras
  (~28 tabellen, grootste cluster, één migration)
- **2F-ii** — Integrations + Webhooks + Sync + Tracking + Ops
  (~18 tabellen, log-pattern dominant)
- **2F-iii** — Product-extras + Invoice-extras + Customer-extras
  (~12 tabellen)
- **2F-iv** — Uncategorized + RLS-status checks + drop-kandidaten
  (case-by-case, max 8 tabellen + cleanup)

## 7. Beslispunten 2F (te bevestigen vóór 2F-i)

- **OB-2F-1 (uncategorized default):** deny-by-default of allow-tenant-scope-read?
  → **Voorstel:** allow-tenant-scope-read (alle rollen), write tenant_admin only.
  Voorkomt UI-breuk; write is conservatief.
- **OB-2F-2 (verlaten tabellen):** `ai_help_conversations`, `ai_help_unanswered`,
  `ai_knowledge_index` droppen in 2F-iv of behouden voor v2-iteratie?
  → **Voorstel:** behouden, alleen rol-aware SELECT (AI-pattern §3.10).
- **OB-2F-3 (geen tenant_id kolom):** `storefront_favorites`, `email_unsubscribes`
  scopen via `customer_id → customers.tenant_id` join, of `auth.uid()`-only?
  → **Voorstel:** join op `customers.tenant_id` waar mogelijk; anders
  service-role-insert + tenant_admin select via join.
- **OB-2F-4 (polymorf):** geen polymorfe tabellen geïdentificeerd in 2F-scope.
  Niet van toepassing.
- **OB-2F-5 (drop-kandidaten):** geen tabellen voorgesteld voor DROP in 2F.
  Alleen rol-aware hardening; drop-discussie naar 2G.
- **OB-2F-6 (`tenant_oauth_credentials`):** strict tenant_admin-only voor alle
  CRUD (gevoelig: bevat OAuth refresh tokens). Bevestigen.
- **OB-2F-7 (loyalty cluster):** loyalty_transactions = log-pattern
  (service-role insert) of staff-insert toestaan voor manuele aanpassingen?
  → **Voorstel:** service-role insert + tenant_admin UPDATE/DELETE voor
  correcties.
- **OB-2F-8 (SEO cluster):** marketing-rol leesrechten op
  `seo_search_console_data` (extern API-data, geen PII)?
  → **Voorstel:** ja, marketing + staff + viewer SELECT toegestaan.

## 8. Tabellen uit masterplan §3.9 die NIET bestaan

`supplier_invoices`, `supplier_payments`, `purchase_requisitions`,
`vendor_contracts`, `rfqs`, `meta_pixels`, `google_negative_keywords`,
`amazon_sponsored_products`, `amazon_sponsored_brands`,
`email_drip_steps`, `email_drip_runs`, `email_consent_log`,
`email_engagement_scores`, `marketing_attribution_models`,
`workflow_definitions`, `workflow_runs`, `task_assignments`,
`task_templates`, `notifications_archive`, `events_processed`,
`events_archive`, `cohort_definitions`, `cohort_members`,
`funnel_definitions`, `funnel_runs`, `customer_referrals`,
`referral_rewards`, `gdpr_requests`, `gdpr_consents`,
`payment_gateways`, `payment_provider_configs`, `chargeback_log`,
`chargeback_disputes`, `sync_jobs`, `sync_job_logs`, `webhook_logs`.

→ Geen actie. Documenteer in `docs/role-audit.md` zodra 2F-migrations zijn
uitgevoerd.

## 9. Pre-flight checks vóór 2F-i

1. RLS-status verifiëren voor alle dormant tabellen (`relrowsecurity = true`).
   `storefront_favorites` heeft 0 policies → check of RLS aan staat.
2. Geen edge function schrijft als tenant-user naar log-tabellen (alleen
   service-role) — grep `supabase/functions/` op `.from('<table>')`.
3. Verifieer `has_tenant_role(tenant_id, ARRAY[...])` helper bestaat en is
   `SECURITY DEFINER` (gebruikt in alle 2A–2E batches → ✅).

---

**Volgende stap:** akkoord op beslispunten OB-2F-1 t/m OB-2F-8 → uitvoering
2F-i (marketing + loyalty + SEO).
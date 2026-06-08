# Batch 2C2 — Marketing & CMS — Recon

**Datum:** 2026-06-08
**Scope:** Email-marketing, discount/promo, ads-platforms, CMS/SEO, A/B tests +
anonymous tracking. Geen code-wijzigingen in deze batch.

Legenda RLS-classificatie (zoals gemeten via pg_policies vandaag):
- ✅ **role-aware** — gebruikt `has_tenant_role(tenant_id, ARRAY[...])`
- ⚠️ **tenant-blind** — alleen `tenant_id IN get_user_tenant_ids(auth.uid())`, geen rol-discriminatie
- 🟡 **legacy-user_roles** — embedded SELECT op `user_roles` met inline rol-lijst (vóór `has_tenant_role`-helper)
- ❌ **unbounded** — `qual = true` of `with_check = true`
- ❓ **other** — afwijkend patroon (publieke catalogue/sellqo-tabellen)

---

## §1. RLS-status per cluster

### Cluster 1 — Email-marketing engine

| Tabel | SELECT | INSERT | UPDATE | DELETE | Opmerking |
|---|---|---|---|---|---|
| `email_campaigns` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | marketing-rol moet hier opengetrokken worden |
| `email_templates` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `email_template_blocks` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `email_signatures` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `email_automations` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | bestaat — drips/triggers via `automation_steps` |
| `automation_steps` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | sub-tabel onder `email_automations` |
| `automation_runs` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | runtime telemetry |
| `automation_step_runs` | ⚠️ | — | — | — | enkel SELECT-policy, INSERT alleen service-role |
| `email_preferences` | ⚠️ | ⚠️ | ⚠️ | — | per-user subscription preferences |
| `email_unsubscribes` | ⚠️ | ⚠️ | — | — | **geen anon-INSERT policy**: huidige `/unsubscribe` edge function gebruikt service-role |
| `campaign_sends` | ⚠️ | ⚠️ | ⚠️ | — | open: viewer-snoop risico |
| `campaign_link_clicks` | ⚠️ SELECT | ❌ INSERT (`true`) | — | — | **risico**: unbounded INSERT laat cross-tenant click-poisoning toe |
| `customer_segments` | ⚠️ SELECT | ✅ | ✅ | ✅ | writes al role-aware; SELECT moet meegetrokken worden |
| `segment_members` | ⚠️ SELECT | ✅ | — | ✅ | idem |
| `newsletter_subscribers` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | klant-INSERT loopt via `newsletter-subscribe` (service-role) — auth-INSERT mag marketing krijgen |
| `tenant_newsletter_config` | ⚠️ | ⚠️ | ⚠️ | — | UPDATE moet `tenant_admin` worden (welcome-email config) |
| `ab_test_configs` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | A/B tests-tabel bestaat; geen `ab_test_variants`/`ab_test_conversions` (varianten ingebed in JSON) |

**Niet aanwezig** (in spec genoemd maar niet in schema): `email_campaign_recipients`, `email_segments` (zit in `customer_segments` + `segment_members`), `email_sends/opens/clicks/bounces` (events worden via `campaign_sends`+`campaign_link_clicks` getrackt, opens/bounces lopen via webhook → `process-email-webhook` zonder dedicated tabel), `email_drips`, `email_triggers`, `email_template_variables`.

### Cluster 2 — Discount & promoties

| Tabel | SELECT | INSERT | UPDATE | DELETE | Opmerking |
|---|---|---|---|---|---|
| `discount_codes` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | INSERT marketing toestaan |
| `discount_code_usage` | ⚠️ SELECT | ⚠️ INSERT | — | — | INSERT moet `service_role`-only (checkout) blijven — huidige policy is tenant-blind |
| `discount_stacking_rules` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `automatic_discounts` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `bogo_promotions` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `volume_discounts` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `volume_discount_tiers` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `gift_promotions` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `gift_cards` | ⚠️ SELECT + ALL | — | — | — | overlappend; ALL-policy moet `tenant_admin/accountant` worden |
| `gift_card_designs` | ⚠️ SELECT + ALL | — | — | — | marketing kan designs beheren |
| `gift_card_transactions` | ⚠️ SELECT + ALL | — | — | — | INSERT service-role (POS/checkout) |
| `loyalty_programs` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `loyalty_tiers` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| `loyalty_transactions` | ⚠️ SELECT | ⚠️ INSERT | — | — | INSERT service-role-only |

**Niet aanwezig:** `coupons` (gebruikt `discount_codes`), `discount_rules` (zit in `discount_codes.rules` JSONB), `discount_redemptions` (= `discount_code_usage`), `promotions`/`promotion_rules` (= `automatic_discounts` + cluster van bogo/volume/gift).

### Cluster 3 — Ads-platforms

Massa tenant-blind. Marketing-rol moet write krijgen op campaigns/adgroups/keywords/creatives; budget-velden zitten **op de campaign-row zelf** (geen aparte `ad_budgets`-tabel), dus budget-restrictie wordt een column-level concern → backlog (2C2-d), niet blocker.

| Tabel | Status | Opmerking |
|---|---|---|
| `ad_campaigns` (generic) | 🟡 ALL+SELECT legacy | `tenant_admin/platform_admin/staff` — marketing ontbreekt |
| `ad_creatives` | 🟡 legacy | idem |
| `ad_audience_syncs` | 🟡 legacy | idem |
| `ad_platform_connections` | ✅ writes role-aware (`tenant_admin`) | OAuth-tokens — blijft `tenant_admin` only |
| `ads_ai_recommendations` | ⚠️ alle 4 cmds | marketing moet UPDATE (accept/reject) krijgen |
| `ads_ai_rules` | ⚠️ alle 4 cmds | idem |
| `ads_product_channel_map` | ⚠️ alle 4 cmds | mapping product↔channel |
| `ads_bolcom_campaigns` + adgroups + keywords + performance + search_terms + targeting_products | ⚠️ alle 4 cmds | bol-cluster — marketing write |
| `ads_google_campaigns`, `ads_google_performance` | ⚠️ alle 4 cmds | sync via cron service-role |
| `ads_meta_campaigns`, `ads_meta_adsets`, `ads_meta_performance` | ⚠️ alle 4 cmds | idem |
| `ads_amazon_campaigns`, `ads_amazon_adgroups`, `ads_amazon_keywords`, `ads_amazon_performance`, `ads_amazon_search_terms` | ⚠️ alle 4 cmds | idem |

**Niet aanwezig:** `ad_groups` (generiek; bestaat per platform: `ads_bolcom_adgroups`, `ads_meta_adsets`), `ad_keywords` (per platform), `ads` (rows), `ad_budgets` (zit in campaign-kolommen `daily_budget`, `total_budget`), `ad_performance_metrics`/`ad_spend_log` (per-platform performance-tabellen vervangen dit).

### Cluster 4 — Blog / CMS / SEO / Theme

| Tabel | Status | Opmerking |
|---|---|---|
| `legal_pages` | ⚠️ alle 4 cmds | marketing-rol toevoegen aan writes |
| `homepage_sections` | ⚠️ alle 4 cmds | idem |
| `storefront_pages` | ⚠️ alle 4 cmds | dit is de CMS-pages tabel |
| `content_translations` | ✅ writes role-aware (na 2C1a-i) | SELECT-policy mag breed blijven |
| `themes` | ❓ public SELECT | catalogus — blijft anon-SELECT |
| `tenant_theme_settings` | ⚠️ INSERT/UPDATE/SELECT | **store-wide impact** → `tenant_admin` only |
| `tenant_theme_presets` | 🟡 legacy | idem |
| `sellqo_legal_pages` | ❓ platform-only | buiten tenant-scope — niet aanraken |
| `seo_keywords` | ⚠️ SELECT + 🟡 writes (legacy + tenant-blind ALL) | overlap: legacy-INSERT/UPDATE/DELETE + blanket ALL-policy — consolideren |
| `seo_competitors`, `seo_competitor_keywords` | 🟡 legacy | marketing/staff/admin write |
| `seo_scheduled_audits` | 🟡 legacy | idem |
| `seo_audit_results` | 🟡 legacy | results — SELECT alle rollen, INSERT service-role (audit-runner) |
| `seo_scores` | ⚠️ ALL + SELECT | overlap — consolideren |
| `seo_search_console_data` | 🟡 legacy | SELECT alle rollen, INSERT service-role (GSC-sync) |
| `seo_web_vitals` | 🟡 legacy | idem |
| `seo_analysis_history` | ⚠️ | tenant-blind, mag blijven |
| `social_channel_connections` | 🟡 legacy | OAuth-tokens — writes `tenant_admin` only |
| `social_connections` | ⚠️ alle 4 cmds | duplicaat-cluster met `social_channel_connections` → backlog |
| `social_posts` | ⚠️ alle 4 cmds | marketing write |
| `message_templates` | ⚠️ alle 4 cmds | marketing/staff write |
| `whatsapp_templates` | 🟡 legacy | marketing/staff write |

**Niet aanwezig:** `blog_posts`, `blog_categories`, `blog_tags`, `cms_pages` (= `storefront_pages`), `cms_blocks` (geen aparte tabel), `cms_revisions`, `seo_meta` (zit per-entity: `products.meta_*`, `categories.meta_*`, `storefront_pages.meta_*`), `seo_redirects`, `seo_sitemap` (gegenereerd door `generate-sitemap` edge function), `landing_pages` (= `storefront_pages`), `menus`/`menu_items` (in `tenant_theme_settings` JSON).

### Cluster 5 — A/B + analytics + notificaties

| Tabel | Status | Opmerking |
|---|---|---|
| `ab_test_configs` | ⚠️ alle 4 cmds | marketing write |
| `feature_usage_events` | ❓ | per-user logging; INSERT eigen events, SELECT eigen tenant |
| `notifications` | ⚠️ alle 4 cmds | trigger schrijft via service-role; auth-INSERT laten staan kan misbruikt worden → `tenant_admin/staff` |
| `tenant_notification_settings` | ⚠️ alle 4 cmds | `tenant_admin` |
| `tenant_tracking_settings` | ✅ ALL + ⚠️ SELECT | writes role-aware; SELECT-policy alle rollen mag blijven |

**Niet aanwezig:** `ab_tests`, `ab_test_variants`, `ab_test_conversions` (varianten/conversies ingebed in `ab_test_configs.variants`/conversions JSONB), `tracking_events` (per-tenant events lopen via `customer_events` voor klantgedrag + `track-storefront-event` edge function die naar `customer_events`/`feature_usage_events` schrijft).

---

## §2. Edge functions — sweep & classificatie

Marketing/CMS-relevante functies in `supabase/functions/`:

### Admin-triggered (tenant-user JWT) — **kandidaat voor `requireRole`**

| Function | Verwachte rol | Status nu |
|---|---|---|
| `ai-generate-email` | marketing/staff/admin | geen requireRole |
| `ai-generate-social` | marketing/staff/admin | geen requireRole |
| `ai-generate-storefront-copy` | marketing/staff/admin | geen requireRole (`verify_jwt=false`) |
| `ai-generate-seo-content` | marketing/staff/admin | **heeft al auth helpers** — bevestigen of `requireRole` actief is |
| `ai-seo-analyzer` | marketing/staff/admin | heeft auth helpers |
| `ai-generate-image` | marketing/staff/admin | geen requireRole (`verify_jwt=false`) |
| `ai-generate-ab-variant` | marketing/staff/admin | geen requireRole (`verify_jwt=false`) |
| `ai-campaign-suggestions` | marketing/staff/admin | geen requireRole |
| `ads-bolcom-manage` | marketing/staff/admin | geen requireRole |
| `ads-bolcom-reports` | marketing/staff/admin/viewer | geen requireRole |
| `ads-bolcom-sync` | marketing/staff/admin (kan ook cron zijn) | geen requireRole — onderzoeken |
| `ads-campaign-analyze` | marketing/staff/admin | heeft auth helpers |
| `ads-ai-engine` | marketing/staff/admin | geen requireRole |
| `push-bol-campaign` | marketing/staff/admin | heeft auth helpers |
| `send-campaign-batch` | marketing/staff/admin | heeft auth helpers (`verify_jwt=false` — secret-based?) |
| `send-test-email` | marketing/staff/admin | heeft auth helpers (`verify_jwt=false`) |
| `newsletter-test-connection` | tenant_admin | geen requireRole (`verify_jwt=false`) |

### Cron / service-role / webhook — **NIET aanraken**

| Function | Reden |
|---|---|
| `automation-scheduler` | cron, draait email-drips |
| `ads-bolcom-scheduler` | cron sync |
| `ads-inventory-watch` | cron auto-pause |
| `sync-bol-campaign-status` | cron |
| `process-email-webhook` | Resend webhook (open/bounce events) |
| `tracking-webhook` | carrier-webhooks |
| `generate-sitemap` | publiek bereikbaar, cron-trigger (geen tenant-auth) |
| `generate-product-feed` | publiek (Google Merchant) |

### Anonymous / storefront-facing — **NIET aanraken** (zorg dat tenant-binding correct is)

| Function | Reden |
|---|---|
| `newsletter-subscribe` | anon klant-flow via storefront-API (tenant via X-Storefront-Key) |
| `newsletter-confirm` | anon double-opt-in link |
| `unsubscribe` | anon unsubscribe-link (signed token) |
| `email-preferences` | anon preferences-link (signed token) |
| `track-storefront-event` | anon beacon — schrijft naar `customer_events` |

---

## §3. Voorgesteld policy-patroon per cluster

Bevestig vóór 2C2a-i wordt gemigreerd.

### Cluster 1 — Email
- **SELECT** templates/campaigns/segments: tenant-scope alle rollen (viewer mag dashboards bouwen)
- **SELECT** `campaign_sends` + `campaign_link_clicks`: **beslispunt §7-1** — voorstel `['tenant_admin','staff','marketing','accountant']` (viewer geen performance-snooping)
- **WRITE** alle email-management tabellen: `has_tenant_role(['tenant_admin','staff','marketing'])`
- `campaign_link_clicks.INSERT`: **fix unbounded `true`** — service-role only (klik-tracker is edge function)
- `newsletter_subscribers.INSERT`: writes via `newsletter-subscribe` edge (service-role); auth-INSERT `marketing`
- `email_unsubscribes.INSERT`: blijft via edge function (`unsubscribe`, service-role + signed token) — geen anon-INSERT policy
- `tenant_newsletter_config.UPDATE`: `tenant_admin` only (welcome-email branding)

### Cluster 2 — Discount/promo
- **SELECT** alle rollen (checkout-preview moet kortingen kunnen tonen)
- **WRITE**: `['tenant_admin','staff','marketing']` op discount_codes/automatic/bogo/volume/gift/stacking
- `discount_code_usage.INSERT`: **service-role only** (checkout RPC), SELECT alle rollen voor rapportage
- `loyalty_transactions.INSERT`: service-role only
- `gift_cards` / `gift_card_designs`: writes `['tenant_admin','staff','marketing']`; `gift_card_transactions.INSERT` service-role
- Loyalty configs (`loyalty_programs`/`loyalty_tiers`): writes `['tenant_admin','staff','marketing']`

### Cluster 3 — Ads
- **SELECT** alle ads-tabellen: tenant-scope alle rollen (**beslispunt §7-2** — viewer mag dashboards zien)
- **WRITE** campaigns/adgroups/keywords/creatives/search_terms/targeting/audience_syncs/performance: `['tenant_admin','staff','marketing']`
- **performance/search_terms.INSERT/UPDATE**: idealiter service-role-only (sync schrijft); huidige sync gebruikt service-role via `SUPABASE_SERVICE_ROLE_KEY` → policies kunnen veilig naar `['tenant_admin','staff','marketing']` voor manuele edits
- `ad_platform_connections` writes: blijft `['tenant_admin']` (OAuth-tokens)
- `ads_ai_recommendations` UPDATE (accept/reject): `['tenant_admin','staff','marketing']`
- Budget-restrictie (`daily_budget`/`total_budget` column-mask voor non-admin): **backlog 2C2-d**

### Cluster 4 — CMS/SEO/Theme/Social
- **SELECT** alle rollen
- **WRITE** content (`storefront_pages`, `homepage_sections`, `legal_pages`, `social_posts`, `message_templates`, `whatsapp_templates`, `seo_keywords`, `seo_competitors`, `seo_competitor_keywords`, `seo_scheduled_audits`): `['tenant_admin','staff','marketing']`
- **WRITE** store-wide config (`tenant_theme_settings`, `tenant_theme_presets`): `['tenant_admin']` only
- **WRITE** OAuth-tokens (`social_channel_connections`): `['tenant_admin']` only
- `seo_audit_results` / `seo_search_console_data` / `seo_web_vitals` INSERT: service-role only (runner/sync); SELECT alle rollen
- `seo_keywords`/`seo_scores` overlap-policies consolideren tot één set

### Cluster 5 — A/B + notifications
- `ab_test_configs`: writes `['tenant_admin','staff','marketing']`
- `notifications` INSERT: trigger schrijft via service-role; auth-INSERT beperken tot `['tenant_admin','staff']`
- `tenant_notification_settings`: writes `['tenant_admin']`

---

## §4. Edge-function changes (sub-batch 2C2d)

`requireRole(['tenant_admin','staff','marketing'])` toevoegen aan:
- `ai-generate-email`
- `ai-generate-social`
- `ai-generate-storefront-copy`
- `ai-generate-image` (marketing-asset generator)
- `ai-generate-ab-variant`
- `ai-campaign-suggestions`
- `ai-seo-analyzer` (bevestigen huidige guard)
- `ai-generate-seo-content` (bevestigen huidige guard)
- `ads-bolcom-manage`
- `ads-bolcom-reports` (eventueel + `viewer`)
- `ads-campaign-analyze` (bevestigen)
- `ads-ai-engine`
- `push-bol-campaign` (bevestigen)
- `send-campaign-batch` (bevestigen — kan secret-auth zijn voor cron-fan-out)
- `send-test-email` (bevestigen)
- `newsletter-test-connection` → `['tenant_admin']`

`requireRole` NIET toevoegen aan:
- `automation-scheduler`, `ads-bolcom-scheduler`, `ads-inventory-watch`, `sync-bol-campaign-status` (cron)
- `process-email-webhook`, `tracking-webhook` (webhooks)
- `newsletter-subscribe`, `newsletter-confirm`, `unsubscribe`, `email-preferences` (anon storefront)
- `track-storefront-event` (anon beacon)
- `generate-sitemap`, `generate-product-feed` (publieke endpoints)

`ads-bolcom-sync`: **te onderzoeken** — als deze óók admin-trigger heeft, dual-path nodig (secret OR `requireRole`).

---

## §5. Risico-analyse

- **Klant-flows blijven via service-role**: `newsletter-subscribe`, `unsubscribe`, `email-preferences`, `track-storefront-event`, validate-discount (in `storefront-api`) — geen breakage door RLS-aanscherping.
- **`campaign_link_clicks.INSERT = true`** is een hard security gat (cross-tenant click-injection). Fix is **niet-optioneel** in 2C2a-i.
- **Anon-tracker tenant-binding**: `track-storefront-event` valideert tenant via `X-Storefront-Key` (storefront API key, SHA-256 hash). Behouden.
- **Cron-functies** schrijven via `SUPABASE_SERVICE_ROLE_KEY` → bypass RLS, niet geraakt door policy-aanscherping.
- **`viewer`-rol op ads/email-events**: bevestigingsverzoek (zie §7).

---

## §6. Voorgestelde sub-volgorde 2C2

| Sub-batch | Inhoud | Snapshot vooraf |
|---|---|---|
| **2C2a-i** | Email marketing engine RLS (cluster 1) + fix `campaign_link_clicks.INSERT` | ✅ |
| **2C2a-ii** | Discount + promo + loyalty + gift cards RLS (cluster 2) | ✅ |
| **2C2a-iii** | Ads-platforms RLS (cluster 3) — generic + per-platform | ✅ |
| **2C2a-iv** | CMS/SEO/Theme/Social RLS (cluster 4) + A/B + notifications (cluster 5) | ✅ |
| **2C2b** | Edge-function `requireRole` sweep (cluster-overstijgend) | n.v.t. |
| **2C2c** *(later)* | Verifiëren overlap-policies geconsolideerd (`seo_keywords`, `seo_scores`, `gift_cards`, `social_connections` vs `social_channel_connections`) | — |
| **2C2d** *(backlog)* | Column-masking ads-budget + per-channel WRITE-restricties + tracking_events tenant-binding audit | — |

---

## §7. Open beslispunten (bevestiging gevraagd vóór 2C2a-i)

1. **Viewer op `campaign_sends` / `campaign_link_clicks`**: open-rate snooping risico → voorstel **uitsluiten** (`['tenant_admin','staff','marketing','accountant']`). Bevestig.
2. **Viewer op ads-campaigns/performance**: concurrentie-gevoelig maar dashboard-relevant → voorstel **toestaan** voor SELECT op alle ads-tabellen. Bevestig.
3. **Anon-INSERT op `campaign_link_clicks`**: huidige `true` is risico. Voorstel **service-role only** (tracker is edge function). Bevestig.
4. **Anon-INSERT op `email_unsubscribes`**: voorstel **geen anon-policy** — blijft via `/unsubscribe` edge met signed token + service-role. Bevestig.
5. **`email_automations`/`automation_steps`/`automation_runs` bestaan** ✅ — geen aparte `email_drips`/`email_triggers` tabel (alles via `automation_steps.step_type`). Bevestigd.
6. **`ab_test_configs` is enige A/B-tabel** ✅ — varianten/conversies in JSONB. Bevestigd: geen aparte `ab_test_variants`/`ab_test_conversions` migraties nodig.
7. **`landing_pages` = `storefront_pages`** ✅ — geen aparte tabel. Bevestigd.
8. **`generate-sitemap`**: huidige aanroep is publiek/cron — voorstel **geen `requireRole`**, blijft anon. Bevestig.
9. **`validate-discount-code` flow**: zit verweven in `storefront-api` edge function (anonymous storefront pad, service-role DB-toegang). Geen aparte edge function. Bevestigd.
10. **`sync-bol-ads` / `sync-google-ads` / `sync-meta-ads`**: enkel `ads-bolcom-sync` + `ads-bolcom-scheduler` bestaan. Beslispunt: is `ads-bolcom-sync` admin-trigger (requireRole) of cron-only? Voorstel **dual-path** (secret-header bypass voor cron, anders `requireRole`). Bevestig.
11. **`ad_budgets`-tabel bestaat niet**: budgetten zijn kolommen op campaign-rows. Column-level masking voor non-`tenant_admin` is **2C2d backlog** (niet blocker). Bevestig.
12. **Duplicaat-cluster `social_connections` vs `social_channel_connections`**: beide bestaan met overlappende doelen. Voorstel: in 2C2a-iv beide hardenen, consolidatie naar één tabel in **2C2c**. Bevestig.
13. **`tenant_theme_settings` / `tenant_theme_presets` writes naar `tenant_admin` only**: marketing kan nu nog niet thema's aanpassen. Akkoord of marketing ook toelaten?
14. **`notifications.INSERT` auth-pad**: trigger gebruikt service-role; auth-INSERT beperken tot `['tenant_admin','staff']`. Bevestig.
15. **Overlap-policies `seo_keywords` + `seo_scores`**: nu zowel een blanket `ALL`-policy als per-cmd legacy-policies. Voorstel: drop blanket, recreate per-cmd met `has_tenant_role`. Bevestig.

---

## §8. Addendum — beslispunten na afsluiting

**§7-12 — Social-tabellen consolidatie (`social_connections` vs `social_channel_connections`)**

- **Oorspronkelijk voorstel:** Beide tabellen hardenen in 2C2a-iv, consolidatie naar één tabel in 2C2c.
- **Uitkomst analyse:** AFGESLOTEN als no-op.
- **Reden:** `social_connections` (OAuth posting accounts, FK vanaf `social_posts`) en `social_channel_connections` (commerce catalog feeds) modelleren twee volledig verschillende domeinen. Samenvoegen zou de `social_posts` FK breken en semantisch onverwante velden in één tabel plaatsen. Beide tabellen zijn leeg in productie; geen runtime-baten.
- **Paper trail:** Zie `docs/role-audit.md` sectie "Batch 2C2c — Social-tabellen consolidatie" voor volledige rationale.
- **Beslispunt herzien:** §7-12 → "Geen consolidatie." Eventuele hernoeming naar duidelijkere namen blijft backlog item.

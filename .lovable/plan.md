

## Prompt 15: Database voorbereiden voor Amazon, Google & Meta Ads

### Overzicht

Eén database migratie die 12 nieuwe tabellen aanmaakt (Amazon 5, Google 2, Meta 3, minus overlapping) en de `ads_global_daily_summary` view vervangt met een 4-kanalen UNION ALL.

### Nieuwe tabellen

**Amazon (5 tabellen)** — spiegelen Bol.com structuur:

| Tabel | Structuur |
|---|---|
| `ads_amazon_campaigns` | id, tenant_id, `amazon_campaign_id`, name, `campaign_type` (sp/sb/sd), status, daily_budget, targeting_type, `bidding_strategy`, raw_data, synced_at, timestamps. UNIQUE(tenant_id, amazon_campaign_id) |
| `ads_amazon_adgroups` | id, campaign_id FK, tenant_id, `amazon_adgroup_id`, name, status, default_bid, raw_data, synced_at. UNIQUE(tenant_id, amazon_adgroup_id) |
| `ads_amazon_keywords` | id, adgroup_id FK, tenant_id, `amazon_keyword_id`, keyword, match_type, bid, status, is_negative, raw_data, synced_at |
| `ads_amazon_performance` | id, tenant_id, campaign_id FK, adgroup_id FK, keyword_id FK, date, impressions, clicks, spend, orders, revenue, acos, ctr, cpc, conversion_rate. UNIQUE(tenant_id, campaign_id, adgroup_id, keyword_id, date) |
| `ads_amazon_search_terms` | id, tenant_id, campaign_id FK, adgroup_id FK, search_term, impressions, clicks, spend, orders, revenue, date, ai_action, ai_action_taken |

**Google (2 tabellen)** — campaign level only:

| Tabel | Structuur |
|---|---|
| `ads_google_campaigns` | id, tenant_id, `google_campaign_id`, name, `campaign_type` (search/shopping/display/pmax), status, daily_budget, bidding_strategy, raw_data, synced_at, timestamps. UNIQUE(tenant_id, google_campaign_id) |
| `ads_google_performance` | id, tenant_id, campaign_id FK, date, impressions, clicks, spend, conversions (not orders), revenue, cost_per_conversion, ctr, cpc. UNIQUE(tenant_id, campaign_id, date) |

**Meta (3 tabellen)** — campaign + adset level:

| Tabel | Structuur |
|---|---|
| `ads_meta_campaigns` | id, tenant_id, `meta_campaign_id`, name, `objective` (conversions/traffic/awareness/reach), status, daily_budget, lifetime_budget, raw_data, synced_at, timestamps. UNIQUE(tenant_id, meta_campaign_id) |
| `ads_meta_adsets` | id, campaign_id FK, tenant_id, `meta_adset_id`, name, status, daily_budget, targeting, raw_data, synced_at. UNIQUE(tenant_id, meta_adset_id) |
| `ads_meta_performance` | id, tenant_id, campaign_id FK, adset_id FK, date, impressions, clicks, spend, conversions, revenue, ctr, cpc, cpm, frequency. UNIQUE(tenant_id, campaign_id, adset_id, date) |

### RLS & Indexes

Alle 10 tabellen krijgen:
- RLS enabled
- 4 policies (SELECT/INSERT/UPDATE/DELETE) met `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`
- Index op `tenant_id`
- Performance tabellen: extra index op `date`, `campaign_id`
- Campaign tabellen: extra index op `status`
- `updated_at` trigger op campaign tabellen

### View update

`CREATE OR REPLACE VIEW public.ads_global_daily_summary` met 4x UNION ALL:

```sql
-- Bol.com (bestaand)
SELECT tenant_id, date, 'bolcom' AS channel, SUM(impressions), SUM(clicks), SUM(spend), SUM(orders), SUM(revenue), ...
FROM ads_bolcom_performance GROUP BY tenant_id, date
UNION ALL
-- Amazon
SELECT tenant_id, date, 'amazon', SUM(impressions), SUM(clicks), SUM(spend), SUM(orders), SUM(revenue), ...
FROM ads_amazon_performance GROUP BY tenant_id, date
UNION ALL
-- Google (orders → conversions)
SELECT tenant_id, date, 'google', SUM(impressions), SUM(clicks), SUM(spend), SUM(conversions), SUM(revenue), ...
FROM ads_google_performance GROUP BY tenant_id, date
UNION ALL
-- Meta (orders → conversions)
SELECT tenant_id, date, 'meta', SUM(impressions), SUM(clicks), SUM(spend), SUM(conversions), SUM(revenue), ...
FROM ads_meta_performance GROUP BY tenant_id, date
```

### Bestanden

| Wat | Actie |
|---|---|
| Database migratie | 10 tabellen + RLS + indexes + view replace |

Geen frontend wijzigingen — het globale dashboard pikt automatisch nieuwe kanalen op via de view.


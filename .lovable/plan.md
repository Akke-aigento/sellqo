

## Prompt 11: Edge Function "ads-bolcom-reports" + Auto-sync op pagina laden

### Overzicht

Nieuwe edge function die performance data, keyword performance en zoektermen ophaalt van de Bol.com Advertising API en upsert naar `ads_bolcom_performance` en `ads_bolcom_search_terms`. Plus auto-fetch logica op de Bol.com Ads pagina met 1-uur cache.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/ads-bolcom-reports/index.ts` | Nieuw — edge function |
| `src/hooks/useBolcomAds.ts` | Auto-sync logica toevoegen |
| `src/pages/admin/AdsBolcom.tsx` | Sync-reports knop/status toevoegen |

### Edge Function: `ads-bolcom-reports/index.ts`

Hergebruikt exact het auth + credentials patroon uit `ads-bolcom-sync`:
- CORS headers, `getBolToken()`, `bolGet()`/`bolPost()`, `withRetry()`, `jsonRes()`
- JWT check via `getUser()`

**Input**: `{ tenant_id, start_date?, end_date? }` — defaults naar laatste 30 dagen

**Flow**:

1. Haal alle campaigns op uit `ads_bolcom_campaigns` (lokale DB) voor de tenant → campaign ID mapping (`bolcom_campaign_id` → internal `id`)

2. **Campaign performance**: POST `{BOL_ADV_BASE}/../insights/campaigns` met `{ campaignIds, startDate, endDate }`
   - Base URL: `https://api.bol.com/advertiser/sponsored-products/insights`
   - Per campagne per dag: upsert naar `ads_bolcom_performance` met:
     - `campaign_id` (internal), `tenant_id`, `date`
     - `impressions`, `clicks`, `spend`, `orders`, `revenue`
     - Berekende velden: `acos`, `ctr`, `cpc`, `conversion_rate`
   - On conflict: `tenant_id, campaign_id, date` (+ keyword_id is null)

3. **Keyword performance** (als API het ondersteunt): probeer `insights/keywords` endpoint
   - Upsert naar `ads_bolcom_performance` met `keyword_id` gevuld
   - On conflict: `tenant_id, campaign_id, keyword_id, date`

4. **Search terms**: POST `insights/search-terms` of vergelijkbaar endpoint
   - Upsert naar `ads_bolcom_search_terms` met `tenant_id, campaign_id, search_term, date`
   - On conflict: `tenant_id, campaign_id, search_term, date`

5. Return `{ days_synced, performance_records, search_term_records }`

**Error handling**: zelfde als ads-bolcom-sync (rate limit, token expired, per-campaign continue)

### Hook: `useBolcomAds.ts` wijzigingen

Voeg auto-sync logica toe:

- Nieuwe query `useQuery` met key `['bolcom-reports-sync', tenantId, period]`:
  - Check of er een `synced_at` timestamp is opgeslagen (`localStorage` key: `bolcom-reports-last-sync-{tenantId}`)
  - Als laatste sync > 1 uur geleden OF nooit: invoke `ads-bolcom-reports` met `tenant_id`, `start_date`, `end_date` (op basis van periode)
  - Na succes: sla timestamp op in localStorage, invalidate performance queries
  - `staleTime: Infinity` en `refetchOnWindowFocus: false` zodat het niet per navigatie opnieuw haalt
- Export een `reportsSyncing` boolean

### Pagina: `AdsBolcom.tsx` wijzigingen

- Toon een subtiele "Data ophalen..." indicator (kleine Loader2 + tekst) bovenaan wanneer `reportsSyncing` true is
- Bestaande "Synchroniseer" knop blijft voor campagne-structuur sync
- Eventueel een "Ververs data" link die de localStorage timestamp reset en reports opnieuw ophaalt

### Technische details

- De Bol.com Insights API gebruikt dezelfde `application/vnd.advertiser.v11+json` headers
- Insights base URL: `https://api.bol.com/advertiser/sponsored-products/insights`
- Afgeleide metrics worden server-side berekend en opgeslagen (niet client-side)
- De 1-uur cache is localStorage-gebaseerd per tenant — simpel en effectief


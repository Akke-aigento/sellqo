

## Prompt 10: Edge Function "ads-bolcom-sync" + Sync knop

### Overzicht

Nieuwe edge function die campagnes, ad groups, keywords en targeted products ophaalt van de Bol.com Advertising API en upsert naar de `ads_bolcom_*` tabellen. Plus een "Synchroniseer" knop op de Bol.com Ads pagina.

### Bestaand patroon

De `sync-bol-campaign-status` edge function bevat al de volledige Bol.com auth-flow (token ophalen via `advertisingClientId`/`advertisingClientSecret` uit `marketplace_connections`). We hergebruiken exact dit patroon.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/ads-bolcom-sync/index.ts` | Nieuw — edge function |
| `src/pages/admin/AdsBolcom.tsx` | Sync knop toevoegen + invoke logic |

### Edge Function: `ads-bolcom-sync/index.ts`

**Auth**: JWT check via `getUser()` (bestaand patroon)

**Flow**:
1. Ontvang `{ tenant_id }` via POST body
2. Haal Bol.com advertising credentials uit `marketplace_connections` (zelfde query als `sync-bol-campaign-status`)
3. Haal token op via `getBolAdvertisingToken()`
4. **Campagnes**: POST `{BOL_ADV_BASE}/campaigns/list` → upsert naar `ads_bolcom_campaigns` (on conflict `tenant_id, bolcom_campaign_id`)
5. **Per campagne → Ad Groups**: GET `{BOL_ADV_BASE}/campaigns/{id}/ad-groups` → upsert naar `ads_bolcom_adgroups`
6. **Per ad group → Keywords**: GET `{BOL_ADV_BASE}/ad-groups/{id}/keywords` → upsert naar `ads_bolcom_keywords`
7. **Per ad group → Target Products**: GET `{BOL_ADV_BASE}/ad-groups/{id}/target-products` → upsert naar `ads_bolcom_targeting_products`. Match `product_id` via EAN lookup in `products` tabel
8. Return `{ campaigns_synced, adgroups_synced, keywords_synced, products_synced }`

**Error handling**:
- 401 → re-auth met credentials en retry eenmaal
- 429 → return error met retry-after
- Per-campagne errors: log + continue met volgende campagne
- Alle upserts gebruiken `onConflict` parameter

**CORS**: Standaard corsHeaders (zelfde als bestaande functions)

**API headers**: `Accept` en `Content-Type` both `application/vnd.advertiser.v11+json` (conform bestaand patroon)

### Pagina: `AdsBolcom.tsx` wijzigingen

- Import `supabase` client en `useQueryClient`
- Voeg `useState` toe voor `syncing` state
- "Synchroniseer" knop in header (naast "Nieuwe campagne") die:
  - `supabase.functions.invoke('ads-bolcom-sync', { body: { tenant_id } })` aanroept
  - Loading spinner toont tijdens sync
  - Na succes: `queryClient.invalidateQueries()` voor alle bolcom query keys + toast met samenvatting
  - Bij error: error toast
- De bestaande lege-state "Synchroniseer" knop krijgt dezelfde handler

### Upsert mapping

Campagnes: `bolcom_campaign_id` → Bol `campaignId`, `name`, `status` (ENABLED→active, PAUSED→paused), `campaign_type` (manual/automatic), `daily_budget`, `total_budget`, `start_date`, `end_date`

Ad Groups: `bolcom_adgroup_id`, `campaign_id` (lookup via bolcom_campaign_id), `name`, `status`, `default_bid`

Keywords: `keyword`, `match_type`, `bid`, `status`, `is_negative`, `adgroup_id` (lookup via bolcom_adgroup_id)

Target Products: `bolcom_product_id` (EAN), `adgroup_id`, `bid`, `status`. Product ID match: query `products` where `bol_ean = ean OR barcode = ean`


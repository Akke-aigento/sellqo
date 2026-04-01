

## Prompt 12: Edge Function "ads-bolcom-manage" + Hook Integratie

### Overzicht

Nieuwe edge function voor campagne/keyword/budget management via Bol.com API, plus aanpassing van 3 hooks om de functie aan te roepen in plaats van alleen lokale DB updates.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/ads-bolcom-manage/index.ts` | Nieuw — edge function |
| `src/hooks/useBolcomCampaignDetail.ts` | Mutations aanpassen → edge function calls |
| `src/hooks/useBolcomKeywords.ts` | `updateKeywordBid` → edge function call |
| `src/hooks/useBolcomSearchTerms.ts` | `addAsNegativeKeyword` → edge function call |

### Edge Function: `ads-bolcom-manage/index.ts`

Hergebruikt auth + Bol API patroon uit `ads-bolcom-sync` (corsHeaders, `getBolToken()`, `bolGet()`/`bolPost()`, JWT check, Supabase client).

**Input**: `{ tenant_id, action, payload }`

**Acties**:

1. **`pause_campaign`** / **`resume_campaign`**: `{ campaign_id }` 
   - Lookup `bolcom_campaign_id` uit `ads_bolcom_campaigns`
   - PUT `{BOL_ADV_BASE}/campaigns/{bolcom_campaign_id}` met `{ state: "PAUSED" }` of `{ state: "ENABLED" }`
   - Update lokale DB status

2. **`update_bid`**: `{ keyword_id, new_bid }`
   - Lookup `bolcom_keyword_id` uit `ads_bolcom_keywords` (via join naar adgroup voor `bolcom_adgroup_id`)
   - PUT `{BOL_ADV_BASE}/keywords/{bolcom_keyword_id}` met `{ bid: new_bid }`
   - Update lokale DB bid

3. **`add_negative_keyword`**: `{ adgroup_id, keyword, match_type }`
   - Lookup `bolcom_adgroup_id` uit `ads_bolcom_adgroups`
   - POST `{BOL_ADV_BASE}/ad-groups/{bolcom_adgroup_id}/negative-keywords` met keyword data
   - Insert in `ads_bolcom_keywords` met `is_negative=true`

4. **`pause_keyword`**: `{ keyword_id }`
   - PUT keyword met `{ state: "PAUSED" }`
   - Update lokale DB status

5. **`update_budget`**: `{ campaign_id, daily_budget }`
   - PUT campaign met `{ dailyBudget: daily_budget }`
   - Update lokale DB `daily_budget`

**Error handling**: Token refresh op 401, rate limit op 429, duidelijke error messages.

**Response**: `{ success: true, action, detail }` of `{ error: string }`

### Hook wijzigingen

**`useBolcomCampaignDetail.ts`** — 3 mutations aanpassen:
- `updateCampaignStatus`: `supabase.functions.invoke('ads-bolcom-manage', { body: { tenant_id, action: status === 'paused' ? 'pause_campaign' : 'resume_campaign', payload: { campaign_id } } })`
- `updateKeywordBid`: action `'update_bid'`, payload `{ keyword_id, new_bid: bid }`
- `addNegativeKeyword`: action `'add_negative_keyword'`, payload `{ adgroup_id, keyword, match_type }`

**`useBolcomKeywords.ts`** — 1 mutation:
- `updateKeywordBid`: zelfde als boven, action `'update_bid'`

**`useBolcomSearchTerms.ts`** — 1 mutation:
- `addAsNegativeKeyword`: action `'add_negative_keyword'`, na succes ook `ai_action_taken` update (blijft lokale DB call)

Alle mutations behouden hun bestaande `onSuccess` (invalidate + toast) en `onError` (error toast) logica.




## Prompt 14: AI Engine — Automatische detectie verspillende zoektermen

### Overzicht

3 onderdelen: (1) Edge function `ads-ai-engine` voor zoekterm-analyse, (2) Default regel aanmaken bij eerste Ads gebruik, (3) Notification badge op AI menu-item in sidebar.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/ads-ai-engine/index.ts` | Nieuw — AI analyse engine |
| `src/hooks/useAdsAI.ts` | Default regel aanmaken + pending count query toevoegen |
| `src/components/admin/sidebar/AdsAiBadge.tsx` | Nieuw — badge component |
| `src/components/admin/AdminSidebar.tsx` | Badge renderen bij ads-ai sub-item |
| `src/components/admin/sidebar/sidebarConfig.ts` | `badge: true` toevoegen op ads-ai item |

### 1. Edge Function: `ads-ai-engine/index.ts`

Hergebruikt service role patroon (geen user auth nodig, wordt door cron of handmatig aangeroepen).

**Input**: `{ tenant_id }`

**Flow**:
1. Query `ads_ai_rules` waar `tenant_id`, `rule_type = 'auto_negative'`, `is_active = true`
2. Per regel: query `ads_bolcom_search_terms` van afgelopen `conditions.lookback_days` (default 14)
3. Filter: `clicks >= min_clicks (10)`, `orders <= max_conversions (0)`, `spend >= min_spend (5.00)`
4. Deduplicatie: check of er al een `pending`/`accepted` recommendation bestaat voor dezelfde `search_term` + `tenant_id`
5. Insert `ads_ai_recommendations` met:
   - `channel: 'bolcom'`, `recommendation_type: 'add_negative_keyword'`, `entity_type: 'search_term'`
   - `current_value`: zoekterm stats, `recommended_value`: keyword + match_type
   - `reason`: Nederlandse zin met zoekterm, clicks, spend, dagen
   - `confidence`: `Math.min(0.95, 0.5 + (clicks / 100))` — meer clicks = hogere confidence
   - `status`: regel `auto_apply = true` → `'auto_applied'`, anders `'pending'`
6. Als `auto_apply`: intern `fetch` naar `ads-bolcom-manage` met `add_negative_keyword` actie (lookup adgroup_id via campaign)
7. Return `{ recommendations_created, auto_applied }`

### 2. Default regel — `useAdsAI.ts`

Voeg een `useEffect` toe die checkt of er al regels bestaan. Zo niet, en tenant heeft Bol.com verbinding:
- `createRule.mutate()` met:
  - `name: "Verspillende zoektermen blokkeren"`
  - `rule_type: "auto_negative"`, `channel: "bolcom"`
  - `conditions: { min_clicks: 10, max_conversions: 0, min_spend: 5.00, lookback_days: 14 }`
  - `actions: { add_as_negative: true, match_type: "exact" }`
  - `is_active: true` (maar auto_apply default false in DB)

Voeg ook een `pendingCount` query toe: `SELECT count(*) FROM ads_ai_recommendations WHERE tenant_id = X AND status = 'pending'`

### 3. Sidebar Badge — `AdsAiBadge.tsx`

Nieuw component dat `ads_ai_recommendations` queried met `status = 'pending'` en tenant_id.
- Toont een klein rood/oranje badge getal als count > 0
- Hergebruikt `useTenant()` hook
- Compacte `useQuery` met `refetchInterval: 60000` (1 min)

### 4. AdminSidebar.tsx wijziging

In de `renderNavItem` functie, bij de rendering van sub-items (lijn 140-144), voeg badge rendering toe voor het `ads-ai` item:
- Check `child.badge && child.id === 'ads-ai'` → render `<AdsAiBadge />`

### 5. sidebarConfig.ts wijziging

Op de `ads-ai` sub-item (lijn 115): toevoegen `badge: true`

### Technische details

- Edge function gebruikt `SUPABASE_SERVICE_ROLE_KEY` om alle tenants te kunnen verwerken
- Confidence formule: `Math.min(0.95, 0.5 + (clicks / 100))` — lineair stijgend met data volume
- De default regel heeft `auto_apply: false` zodat merchants eerst handmatig moeten goedkeuren


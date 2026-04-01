

## Analyse: Ad Stats — Fantoomdata bevestigd

### Bevinding

De advertentiedata (Bereik, Clicks, Uitgaven, ROAS) is **100% fantoom**. Er wordt nergens performance data opgehaald van Bol.com.

**`sync-bol-campaign-status`** haalt alleen op:
- Campaign `state` (ENABLED/PAUSED)
- `dailyBudget`

Het update **geen** `impressions`, `clicks`, `spend`, `revenue` of `roas`. Die kolommen in `ad_campaigns` blijven altijd op 0.

### Wat Bol.com aanbiedt

De Bol Advertising API heeft een **aparte Insights/Reporting API** (`/insights/campaigns`) die performance metrics levert per dag:
- impressions, clicks, spend, conversions, revenue, ROAS

### Fix

**Bestand 1: `supabase/functions/sync-bol-campaign-status/index.ts`**

Na het ophalen van campaign statussen, ook de Insights API aanroepen:
- `POST /insights/campaigns` met `campaignIds`, `startDate`, `endDate` (laatste 30 dagen)
- Response bevat per campaign: `impressions`, `clicks`, `cost`, `conversions`, `revenue`
- Deze waarden optellen en updaten in `ad_campaigns` tabel

**Bestand 2: `src/components/admin/ads/AdsDashboard.tsx`**

De stats cards tonen al data uit `ad_campaigns` — zodra de sync echte data schrijft, worden deze automatisch gevuld. Geen frontend wijziging nodig.

### Belangrijk

De Bol Insights API endpoint en exact payload formaat moet geverifieerd worden tegen de officiële docs. De `Accept` header moet `application/vnd.advertiser.v11+json` zijn (zelfde als de campaign management API).

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/sync-bol-campaign-status/index.ts` | Insights API call toevoegen om impressions/clicks/spend/revenue op te halen en op te slaan |


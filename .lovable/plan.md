

## Prompt 5: Bol.com Ads Dashboard (/admin/ads/bolcom)

### Overzicht

Vervang de placeholder `AdsBolcom.tsx` met een volledig kanaal-specifiek dashboard. Maak een custom hook `useBolcomAds` voor alle data queries.

### Nieuwe bestanden

**1. `src/hooks/useBolcomAds.ts`** — Data hook

Queries (allemaal gefilterd op tenant_id + periode):
- **Performance KPIs**: Aggregeer `ads_bolcom_performance` voor huidige + vorige periode → spend, revenue, acos, ctr, conversion_rate
- **Daily chart data**: `ads_bolcom_performance` per dag → spend, revenue, acos
- **Campaigns**: `ads_bolcom_campaigns` + geaggregeerde performance (spend, impressions, clicks, orders, revenue, acos) via aparte query op `ads_bolcom_performance` grouped by campaign_id
- **Top Keywords**: `ads_bolcom_keywords` joined met `ads_bolcom_performance` (via keyword_id), top 10 by clicks
- **Top Search Terms**: `ads_bolcom_search_terms` top 10 by clicks, markeer hoge spend + 0 orders

Returns: `{ isLoading, hasData, kpis, chartData, campaigns, topKeywords, topSearchTerms }`

**2. `src/pages/admin/AdsBolcom.tsx`** — Volledige pagina rewrite

Secties van boven naar beneden:

1. **Header**: Breadcrumb (Ads > Bol.com), titel, "Nieuwe campagne" knop (disabled) + periode-selector (7d/30d/90d)

2. **5 KPI Cards**: Spend, Omzet, ACoS, CTR, Conversieratio — hergebruik `KPICard` patroon uit Ads.tsx (of inline component)

3. **Dual-axis chart** (Recharts): `LineChart` met spend+revenue op linker Y-as, ACoS op rechter Y-as, datum op X-as

4. **Campagnes tabel**: Sorteerbare tabel met kolommen: Naam, Status (badge), Budget, Targeting, Spend, ACoS, Impressies, Clicks, Orders. Rijen klikbaar → `/admin/ads/bolcom/campaigns/:id`

5. **Twee kolommen**:
   - Links: Top 10 Keywords (keyword, match_type badge, bid, clicks, acos)
   - Rechts: Top 10 Zoektermen (zoekterm, clicks, spend, orders, acos) — rood highlight bij hoge spend + 0 orders

6. **Empty state**: Als geen campaigns, toon melding + "Synchroniseer" knop

### Routes

Geen nieuwe routes nodig — `/admin/ads/bolcom` bestaat al in App.tsx.

### Bestaande patronen

- Hergebruik `formatCurrency`, `ChangeIndicator` uit Ads.tsx (of dupliceer inline)
- Recharts, Card, Badge, Table, Button componenten al beschikbaar
- `useTenant()` voor tenant_id filtering
- Sorting state met `useState` voor tabel

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useBolcomAds.ts` | Nieuw — data hook |
| `src/pages/admin/AdsBolcom.tsx` | Herschrijven — volledig dashboard |


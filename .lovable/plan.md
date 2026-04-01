

## Campagne Detail Pagina — /admin/ads/bolcom/campaigns/:id

### Overzicht

Nieuwe pagina + hook + route toevoegen voor het campagne detail scherm met performance chart, ad groups (accordion), keywords (inline edit), en negatieve keywords.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useBolcomCampaignDetail.ts` | Nieuw — data hook |
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | Nieuw — pagina |
| `src/App.tsx` | Route toevoegen |

### Hook: `useBolcomCampaignDetail.ts`

Queries gefilterd op campaign ID + tenant_id:
- **Campaign**: `ads_bolcom_campaigns` single row by id
- **Performance**: `ads_bolcom_performance` where campaign_id, voor chart + KPIs (periode selector 7d/30d/90d)
- **Ad Groups**: `ads_bolcom_adgroups` where campaign_id
- **Keywords per ad group**: `ads_bolcom_keywords` where adgroup_id in (campaign ad groups), inclusief `is_negative` flag
- **Keyword performance**: `ads_bolcom_performance` where keyword_id is not null, aggregated

Mutations:
- `updateCampaignStatus(status)` → update `ads_bolcom_campaigns.status`
- `updateKeywordBid(keywordId, bid)` → update `ads_bolcom_keywords.bid`
- `toggleKeywordStatus(keywordId, status)` → update `ads_bolcom_keywords.status`
- `addKeyword(adgroupId, keyword, matchType, bid)` → insert `ads_bolcom_keywords`
- `addNegativeKeyword(adgroupId, keyword, matchType)` → insert `ads_bolcom_keywords` with `is_negative=true`

### Pagina: `AdsBolcomCampaignDetail.tsx`

6 secties van boven naar beneden:

1. **Header** — Breadcrumb (Ads > Bol.com > naam), status badge, Pauzeren/Hervatten + Bewerken knoppen
2. **Info cards** — 5 horizontale cards: type, dagbudget, totaalbudget, start/einddatum, laatste sync
3. **Performance chart** — Recharts LineChart: spend + revenue (left Y) + ACoS (right Y), periode selector
4. **Ad Groups tabel** — Accordion-stijl met Radix Accordion; kolommen: naam, status, default bid, keyword count, spend, acos
5. **Keywords** (in uitgeklapte ad group) — Tabel met inline bid editing (click-to-edit input), status switch toggle, "Keyword toevoegen" knop met inline form
6. **Negatieve Keywords** — Gefilterd op `is_negative=true`, met "Toevoegen" knop die een Dialog opent (keyword + match type select)

### Route

In `App.tsx` toevoegen:
```
/admin/ads/bolcom/campaigns/:id → AdsBolcomCampaignDetail
```

### Patronen

- Hergebruik `Period` type en periode-selector UI uit `useBolcomAds`
- Inline bid editing: `useState` per keyword, klik op bedrag → input, blur/enter → save mutation
- Status toggle: `Switch` component, onChange → `toggleKeywordStatus` mutation
- Negative keyword modal: `Dialog` met `Input` + `Select` (match type: exact/phrase/broad)
- Alle mutations invalideren relevante query keys


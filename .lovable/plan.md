

## Prompt 7: Bol.com Keywords Overzichtspagina

### Overzicht

Nieuwe pagina + hook voor `/admin/ads/bolcom/keywords` — toont alle keywords across alle campagnes met filters, bulk acties, inline bid editing en performance KPIs.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useBolcomKeywords.ts` | Nieuw — data hook |
| `src/pages/admin/AdsBolcomKeywords.tsx` | Nieuw — pagina |
| `src/App.tsx` | Route toevoegen + import |

### Hook: `useBolcomKeywords.ts`

**Queries** (gefilterd op tenant_id + 30d default):
- `ads_bolcom_keywords` met `ads_bolcom_adgroups` (voor adgroup naam + campaign_id) en `ads_bolcom_campaigns` (voor campagne naam)
- `ads_bolcom_performance` waar keyword_id niet null is, geaggregeerd per keyword_id over periode → impressions, clicks, spend, orders, revenue
- Combineert keywords + performance client-side

**Filters** (useState):
- `campaignId: string | null`
- `matchType: string | null` (exact/phrase/broad/all)
- `status: string | null` (active/paused/all)
- `search: string`

**Mutations**:
- `updateKeywordBid(keywordId, bid)` → update `ads_bolcom_keywords.bid`
- `bulkUpdateStatus(keywordIds[], status)` → update `ads_bolcom_keywords.status`
- `bulkDelete(keywordIds[])` → delete from `ads_bolcom_keywords`

**Returns**: filtered/sorted keywords list, campaigns list (voor dropdown), KPI summary, mutations, filter state

### Pagina: `AdsBolcomKeywords.tsx`

1. **Header** — Breadcrumb (Ads > Bol.com > Keywords), titel "Bol.com Keywords"

2. **KPI cards** (4 in een rij):
   - Totaal actieve keywords (count)
   - Gemiddeld bod (€)
   - Totale keyword spend (€)
   - Best presterende keyword (laagste ACoS met ≥10 clicks)

3. **Filters** (horizontale balk):
   - Campagne dropdown (Select component)
   - Match Type filter (Select)
   - Status filter (Select)
   - Zoekbalk (Input)

4. **Keywords tabel**:
   - Kolommen: checkbox, Keyword, Campagne, Ad Group, Match Type (badge), Bod (inline edit), Status, Impressies, Clicks, Spend, Orders, Revenue, ACoS, CTR
   - Sorteerbaar op numerieke kolommen via useState sort state
   - Inline bid editing: klik → input → blur/enter save (zelfde patroon als CampaignDetail)
   - Checkbox selectie → bulk action bar: Pauzeren / Hervatten / Verwijderen
   - Rijkleuring: ACoS >30% licht rood, ACoS <10% licht groen

### Route

In `App.tsx`:
```
<Route path="ads/bolcom/keywords" element={<AdsBolcomKeywordsPage />} />
```
Toevoegen na de `ads/bolcom/campaigns/:id` route.

### Patronen

- Hergebruik `Period` type, `formatCurrency`, `formatPct` helpers
- `useTenant()` voor tenant filtering
- `Checkbox` component voor bulk selectie
- Bestaande `Select`, `Input`, `Table`, `Card`, `Badge`, `Button` componenten


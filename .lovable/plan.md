

## Prompt 8: Bol.com Zoektermen Rapport — /admin/ads/bolcom/search-terms

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useBolcomSearchTerms.ts` | Nieuw — data hook |
| `src/pages/admin/AdsBolcomSearchTerms.tsx` | Nieuw — pagina |
| `src/App.tsx` | Route toevoegen |

### Hook: `useBolcomSearchTerms.ts`

**Queries** (tenant_id + periode):
- `ads_bolcom_search_terms` alle kolommen incl. `ai_action`, `ai_action_taken`, `campaign_id`, `adgroup_id`
- `ads_bolcom_campaigns` voor campagne namen (lookup map)
- Aggregeer per `search_term` over de periode: impressions, clicks, spend, orders, revenue
- Bereken ACoS, CTR per zoekterm

**Filters** (useState):
- `search: string`
- `onlyNoConversions: boolean` (toggle)
- `onlyWithAiSuggestion: boolean` (toggle)
- Sortering: default `spend` desc

**Mutations**:
- `addAsNegativeKeyword(searchTerm, adgroupId, matchType)` → insert `ads_bolcom_keywords` met `is_negative=true`, keyword=searchTerm. Als `ai_action` bestond → update `ads_bolcom_search_terms.ai_action_taken=true`
- `promoteToKeyword(searchTerm, adgroupId, matchType, bid)` → insert `ads_bolcom_keywords` met `is_negative=false`, bid. Update `ai_action_taken=true` als relevant

**Summary** (useMemo):
- Totaal unieke zoektermen
- Zoektermen met conversies (count + %)
- Zoektermen zonder conversies maar met spend (count + totale verspilde spend €)
- AI suggesties pending (count where ai_action != null && ai_action_taken != true)

### Pagina: `AdsBolcomSearchTerms.tsx`

Zelfde opbouwpatroon als `AdsBolcomKeywords.tsx`:

1. **Header** — Breadcrumb (Ads > Bol.com > Zoektermen), titel, periode-selector
2. **4 KPI cards** — unieke zoektermen, met conversies, zonder conversies (waste), AI suggesties pending
3. **Filters** — Zoekbalk + "Alleen zonder conversies" toggle + "Alleen met AI suggestie" toggle
4. **Tabel** — Zoekterm, Campagne, Impressies, Clicks, Spend, Orders, Revenue, ACoS, CTR, Acties
   - Sorteerbaar op alle numerieke kolommen
   - Rijkleuring: spend>€5 + 0 orders → rood, orders + ACoS<15% → groen, ai_action → geel icoon
   - Actie knoppen per rij:
     - **→ Negatief**: Dialog met match type keuze (exact/phrase) → `addAsNegativeKeyword`
     - **→ Keyword**: Dialog met match type + bod input → `promoteToKeyword`
     - AI badge als `ai_action` aanwezig

### Route

```
<Route path="ads/bolcom/search-terms" element={<AdsBolcomSearchTerms />} />
```

### Patronen
- Hergebruik `Period`, `fmt`, `fmtPct` helpers
- `Dialog` voor mini-modals (zelfde als negatieve keyword modal in CampaignDetail)
- `useTenant()` voor tenant filtering
- Invalidate query keys na mutaties


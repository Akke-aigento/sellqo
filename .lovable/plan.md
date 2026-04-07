

## AI Campaign Optimizer — Slimme suggesties op campagne-detailpagina

### Wat het doet

Een nieuwe "AI Analyse" sectie op de Bol.com campagne-detailpagina die:
1. De performance data (keywords, ad groups, spend/revenue/ACoS) verstuurt naar AI
2. Concrete, actionable suggesties terugkrijgt (bijv. "Verhoog bod op keyword X van €0.25 naar €0.40", "Pauzeer keyword Y — 0 orders bij €12 spend", "Voeg negatief keyword Z toe")
3. Elke suggestie heeft een **"Toepassen"** knop die de wijziging direct doorvoert via de bestaande `ads-bolcom-manage` edge function
4. Suggesties worden opgeslagen in de bestaande `ads_ai_recommendations` tabel

### Architectuur

```text
┌─────────────────────────┐
│  CampaignDetail page    │
│  ┌───────────────────┐  │
│  │ AI Analyse Card   │  │
│  │  [Analyseer] btn  │  │
│  │                   │  │
│  │  Suggestie 1  [✓] │  │
│  │  Suggestie 2  [✓] │  │
│  │  Suggestie 3  [✗] │  │
│  └───────────────────┘  │
└───────────┬─────────────┘
            │ invoke
  ┌─────────▼──────────┐
  │ ads-campaign-      │
  │ analyze (edge fn)  │
  │  - Gather data     │
  │  - Call Lovable AI │
  │  - Save to DB      │
  │  - Return results  │
  └─────────┬──────────┘
            │ on accept
  ┌─────────▼──────────┐
  │ ads-bolcom-manage  │
  │  (existing)        │
  │  - update_bid      │
  │  - toggle_keyword  │
  │  - add_negative    │
  └────────────────────┘
```

### Nieuwe bestanden

**1. `supabase/functions/ads-campaign-analyze/index.ts`** — Edge function
- Ontvangt `campaign_id` + `tenant_id`
- Haalt op uit DB: campaign info, ad groups, keywords + performance, search terms
- Bouwt een gestructureerde prompt met alle data
- Roept Lovable AI aan (gemini-3-flash-preview) met tool calling om gestructureerde suggesties te extraheren
- Elke suggestie bevat: `action_type` (increase_bid / decrease_bid / pause_keyword / add_negative / resume_keyword), `entity_id`, `current_value`, `recommended_value`, `reason`, `confidence`
- Slaat suggesties op in `ads_ai_recommendations` met status `pending`
- Retourneert de suggesties

**2. `src/components/admin/ads/CampaignAIAnalysis.tsx`** — UI component
- "AI Analyse" card met gradient header (sparkles icoon)
- "Analyseer campagne" knop die de edge function aanroept
- Toont suggesties als kaartjes met:
  - Icoon per type (TrendingUp voor bid changes, Ban voor negatieven, Pause voor pauzeren)
  - Beschrijving in natuurlijke taal (de `reason`)
  - Huidige vs aanbevolen waarde
  - Confidence indicator
  - **"Toepassen"** (groen) en **"Negeren"** (grijs) knoppen
- Bij "Toepassen": roept `ads-bolcom-manage` aan met de juiste action + payload, update status naar `accepted`
- Bij "Negeren": update status naar `rejected`
- Loading state met skeleton cards tijdens analyse

### Wijzigingen aan bestaande bestanden

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | `<CampaignAIAnalysis>` component toevoegen tussen de Performance chart en de Ad Groups sectie |

### Edge function detail — `ads-campaign-analyze`

De prompt bevat:
- Campagne naam, type (AUTO/MANUAL), dagbudget
- Per keyword: keyword text, match type, huidig bod, impressies, clicks, spend, orders, ACoS
- Per ad group: naam, default bid, totale spend/revenue
- Zoektermen met hoge spend en lage conversie

Tool calling schema voor gestructureerde output:
```json
{
  "name": "campaign_suggestions",
  "parameters": {
    "suggestions": [{
      "action_type": "increase_bid | decrease_bid | pause_keyword | add_negative | resume_keyword",
      "entity_id": "keyword/adgroup id",
      "entity_name": "keyword text",
      "current_value": "€0.25",
      "recommended_value": "€0.40",
      "reason": "Dit keyword heeft een ACoS van 8% — ruim onder target. Hoger bod = meer impressies.",
      "confidence": 0.85,
      "priority": "high | medium | low"
    }]
  }
}
```

### Apply-logica per action type

| Action | ads-bolcom-manage action | Payload |
|--------|--------------------------|---------|
| `increase_bid` / `decrease_bid` | `update_keyword_bid` | `{ keyword_id, bid }` |
| `pause_keyword` | `toggle_keyword` | `{ keyword_id, status: "paused" }` |
| `resume_keyword` | `toggle_keyword` | `{ keyword_id, status: "active" }` |
| `add_negative` | `add_negative_keyword` | `{ adgroup_id, keyword, match_type }` |

### Geen database wijzigingen nodig
De bestaande `ads_ai_recommendations` tabel heeft alle benodigde velden (recommendation_type, entity_id, current_value, recommended_value, reason, confidence, status).


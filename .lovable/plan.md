

## Prompt 9: AI Aanbevelingen Pagina — /admin/ads/ai

### Overzicht

Vervang de placeholder `AdsAiRules.tsx` met een volledige pagina met 3 tabs. Maak een custom hook `useAdsAI` voor alle data queries.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useAdsAI.ts` | Nieuw — data hook |
| `src/pages/admin/AdsAiRules.tsx` | Herschrijven — volledige pagina |

Geen route wijziging nodig — `/admin/ads/ai` bestaat al in App.tsx.

### Hook: `useAdsAI.ts`

**Queries** (tenant_id gefilterd):

- **Recommendations**: `ads_ai_recommendations` — alle kolommen incl. `current_value`, `recommended_value`, `confidence`, `auto_apply`, `applied_at`
- **Rules**: `ads_ai_rules` — alle kolommen incl. `conditions` (Json), `actions` (Json), `is_active`, `last_triggered_at`
- **History**: `ads_ai_recommendations` where status in ('accepted', 'auto_applied'), order by applied_at desc

**Filters** (useState):
- `channel: string | null` (bolcom/amazon/google/meta/all)
- `type: string | null` (recommendation_type filter)
- `status: string | null` (pending/accepted/rejected)

**Mutations**:
- `applyRecommendation(id)` → update `ads_ai_recommendations` set status='accepted', applied_at=now()
- `rejectRecommendation(id)` → update status='rejected'
- `toggleRule(id, isActive)` → update `ads_ai_rules` set is_active
- `createRule(data)` → insert `ads_ai_rules` met name, channel, rule_type, conditions, actions
- `updateRule(id, data)` → update `ads_ai_rules`
- `deleteRule(id)` → delete from `ads_ai_rules`

### Pagina: `AdsAiRules.tsx` (herschrijven)

**Header** — Breadcrumb (Ads > AI), titel "AI Aanbevelingen", Sparkles icoon

**Tabs**: Aanbevelingen | Automation Regels | Geschiedenis

#### Tab 1: Aanbevelingen (default)

- Filter balk: Kanaal select, Type select, Status select
- Card-based lijst per aanbeveling:
  - Kanaal badge (kleurcodering: bolcom=blauw, amazon=oranje, google=groen, meta=blauw)
  - Type icoon + label
  - Reden tekst
  - Current value → Recommended value (visueel met pijl)
  - Confidence score als progress bar
  - "Toepassen" (groen) + "Negeren" (grijs) knoppen
  - Timestamp
- Empty state als geen pending recommendations

#### Tab 2: Automation Regels

- Regels lijst met per regel:
  - Naam, type badge, kanaal badge, status Switch toggle, "Bewerken" knop, laatste trigger datum
- "Nieuwe regel" knop → Dialog met:
  - Naam input, Kanaal select, Type select
  - Dynamische conditie-velden op basis van type:
    - `auto_negative`: min clicks, max conversions, min spend, lookback days
    - `bid_adjustment`: target ACoS, min data points, max bid change %
    - `inventory_pause`: min stock level
    - `budget_pacing`: budget threshold %, actie select (warn/reduce)
  - Auto-apply toggle

#### Tab 3: Geschiedenis

- Tabel: Datum, Kanaal, Type, Beschrijving (reason), Status badge (auto/handmatig), Door (AI/merchant)
- Gefilterd op status='accepted' of 'auto_applied'
- Sorteer op datum desc

### Patronen

- Hergebruik `useTenant()`, `Card`, `Badge`, `Button`, `Dialog`, `Switch`, `Select`, `Input`, `Tabs`, `Progress` componenten
- Kanaal kleuren: `{ bolcom: 'blue', amazon: 'orange', google: 'green', meta: 'blue' }`
- `Json` velden (`current_value`, `recommended_value`, `conditions`, `actions`) casten naar `Record<string, unknown>` client-side


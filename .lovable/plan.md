
## Jaarlijks/maandelijks toggle toevoegen aan billing upgrade pagina

### Probleem
De billing-pagina heeft al een `selectedInterval` state variabele, maar er is geen UI-toggle om tussen maandelijks en jaarlijks te wisselen. De marketingpagina heeft dit wél (met Switch component + "Bespaar 2 maanden" badge).

### Oplossing

**1. Toggle toevoegen in `PlanComparisonCards.tsx`**

- Voeg een maandelijks/jaarlijks Switch toggle toe boven de plan cards (zelfde stijl als PricingSection)
- Toon "Bespaar 2 maanden" badge bij jaarlijks
- Pas de weergegeven prijs aan: maandelijks toont €X/maand, jaarlijks toont €X/jaar
- Voeg een `onIntervalChange` callback prop toe

**2. Interval doorsturen in `Billing.tsx`**

- Koppel de `selectedInterval` state aan de toggle via `onIntervalChange`
- De checkout en plan-switch calls gebruiken al `selectedInterval`, dus die werken automatisch mee

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanComparisonCards.tsx` | Toggle UI toevoegen, prijsweergave aanpassen op basis van interval, `onIntervalChange` prop |
| `src/pages/admin/Billing.tsx` | `onIntervalChange` koppelen aan `setSelectedInterval` |

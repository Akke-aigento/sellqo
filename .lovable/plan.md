

## Fix: "Excl. BTW" → "Incl. BTW" overal consistent maken

### Probleem
Op drie plekken staat "Alle prijzen zijn exclusief BTW", en in de plan-switch preview staat "Subtotaal excl. BTW". De user wil dat overal duidelijk **inclusief BTW** staat.

### Wijzigingen

**1. `src/components/admin/billing/PlanComparisonCards.tsx` (regel 410)**
- "Alle prijzen zijn exclusief BTW" → "Alle prijzen zijn inclusief BTW"

**2. `src/components/landing/PricingSection.tsx` (regel 367)**
- "Alle prijzen zijn exclusief BTW" → "Alle prijzen zijn inclusief BTW"

**3. `src/pages/Pricing.tsx` (regel 262)**
- "Alle prijzen zijn exclusief BTW" → "Alle prijzen zijn inclusief BTW"

**4. `src/components/admin/billing/PlanSwitchPreview.tsx` (regels 133-155)**
- "Subtotaal excl. BTW" → "Subtotaal"
- "Totaal incl. BTW" → "Totaal (incl. BTW)" — behouden want hier is het juist wél relevant om te benoemen dat BTW erin zit, naast de aparte BTW-regel

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanComparisonCards.tsx` | "exclusief" → "inclusief" |
| `src/components/landing/PricingSection.tsx` | "exclusief" → "inclusief" |
| `src/pages/Pricing.tsx` | "exclusief" → "inclusief" |
| `src/components/admin/billing/PlanSwitchPreview.tsx` | Labels verduidelijken |

### Geen database wijzigingen nodig


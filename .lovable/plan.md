

## Fix: Upgrade knoppen layout — twee regels, geen features

### Wat er verandert

De upgrade knoppen worden:
- **Regel 1:** "Upgrade naar" (kleiner, normaal gewicht)
- **Regel 2:** Plan naam (groter, bold)
- **Geen** "+X features erbij" tekst meer (staat al boven de knop)

### Bestand

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanComparisonCards.tsx` | Button layout: twee regels, features-tekst verwijderen |

### Code-aanpassing (regels 379-393)

```tsx
<Button
  className="w-full h-auto py-3 flex-col gap-0 shadow-lg transition-all duration-200 hover:shadow-xl"
  onClick={() => onSelectPlan(plan.id, true)}
  disabled={isLoading}
>
  <span className="text-xs font-normal opacity-90">Upgrade naar</span>
  <span className="text-sm font-semibold">{plan.name}</span>
</Button>
```

### Geen database wijzigingen nodig


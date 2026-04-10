

## Fix: Varianten automatisch synchroniseren bij optie-wijzigingen

### Probleem
Als je een optiewaarde wijzigt (bijv. kleur "Rood" → "Bordeaux"), blijven de bestaande varianten ongewijzigd met de oude waarden. De "Varianten genereren" knop voegt alleen **nieuwe** combinaties toe maar ruimt verouderde niet op.

### Oplossing
Twee aanpassingen in `src/hooks/useProductVariants.ts`:

1. **Nieuwe `syncVariants` mutatie** — wordt automatisch aangeroepen na het updaten van opties. Deze:
   - Verwijdert varianten waarvan de `attribute_values` waarden bevatten die niet meer bestaan in de huidige opties
   - Genereert ontbrekende combinaties (hergebruikt de bestaande `generateVariants` logica)
   - Behoudt bestaande varianten die nog geldig zijn (prijs, voorraad, SKU blijven intact)

2. **`updateOption` callback aanpassen** — na succesvolle optie-update automatisch de sync triggeren

### Aanpassing in `ProductVariantsTab.tsx`
- Na het updaten van optiewaarden: automatisch `syncVariants` aanroepen
- Gebruiker ziet een toast: "3 verouderde varianten verwijderd, 2 nieuwe aangemaakt"

### Wat de gebruiker ziet
```text
Optie "Kleur" waarden: Rood, Blauw → Rood, Groen

Resultaat:
- Variant "Rood / M" → blijft behouden (Rood bestaat nog)
- Variant "Blauw / M" → verwijderd (Blauw bestaat niet meer)  
- Variant "Groen / M" → nieuw aangemaakt
```

### Bestanden
| Bestand | Wat |
|---------|-----|
| `src/hooks/useProductVariants.ts` | Nieuwe `syncVariants` mutatie toevoegen |
| `src/components/admin/products/ProductVariantsTab.tsx` | Na optie-update automatisch sync triggeren |


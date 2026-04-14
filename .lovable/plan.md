

# Tag-invoer voor variant optiewaarden

## Probleem
De huidige invoer voor optiewaarden (bijv. "Rood, Blauw, Groen") is een platte tekst-input met komma-scheiding. Dit is foutgevoelig en niet intuïtief. De gebruiker wil "vakjes" — oftewel een tag/chip-invoer waarbij elke waarde als apart blokje verschijnt dat individueel verwijderd kan worden.

## Oplossing

### Nieuw component: `TagInput`
**Bestand:** `src/components/ui/tag-input.tsx`

Een herbruikbaar tag-invoer component:
- Toont elke waarde als een `Badge` met een ×-knopje
- Nieuwe waarde toevoegen door te typen en Enter of komma te drukken
- Waarden individueel verwijderen door op het ×-knopje te klikken
- Backspace verwijdert de laatste tag als het invoerveld leeg is
- Plakken van komma-gescheiden tekst splitst automatisch in meerdere tags

```text
  ┌─────────────────────────────────────────────┐
  │ [Rood ×] [Blauw ×] [Groen ×]  typ hier... │
  └─────────────────────────────────────────────┘
```

### Aanpassing: `ProductVariantsTab.tsx`

**Twee plekken** waar de komma-gescheiden input vervangen wordt:

1. **Nieuwe optie toevoegen** (~regel 300-307): De `Input` voor `newOptionValues` wordt een `TagInput`. State verandert van `string` naar `string[]`.

2. **Bestaande optie bewerken** (~regel 231-244): De `Input` voor `editOptionValues` wordt ook een `TagInput`. State verandert van `string` naar `string[]`.

De `handleAddOption` en `handleUpdateOptionValues` functies worden aangepast om direct met arrays te werken in plaats van `.split(',')`.

### Wat er niet verandert
- De opslag-logica (options worden al als arrays opgeslagen)
- De badge-weergave van bestaande waarden in niet-edit modus
- Geen database-wijzigingen




# Variant waarden: dynamische invoervelden i.p.v. TagInput

## Idee
Vervang de TagInput (comma/Enter-gebaseerd) door een lijst van individuele tekstvelden. Zodra de gebruiker begint te typen in het laatste (lege) veld, verschijnt er automatisch een nieuw leeg veld eronder. Elke waarde heeft een verwijderknop (×). Simpel en intuïtief — geen Enter of komma nodig.

## Aanpak

### 1. Nieuw component: `DynamicValueInputs`
**Bestand:** `src/components/ui/dynamic-value-inputs.tsx`

- Props: `values: string[]`, `onChange: (values: string[]) => void`, `placeholder?: string`
- Rendert voor elke waarde een `Input` + ×-knop, plus altijd één leeg veld onderaan
- Bij `onChange` van het laatste (lege) veld: zodra niet-leeg → voeg lege string toe aan array (= nieuw veld verschijnt)
- Bij verwijderen: filter de waarde weg
- Bij blur van een veld dat leeg is (en niet het laatste): verwijder het automatisch
- Expose `commitPending()` via ref (filtert lege strings uit en retourneert finale array)

### 2. ProductVariantsTab aanpassen
**Bestand:** `src/components/admin/products/ProductVariantsTab.tsx`

- Vervang `TagInput` import door `DynamicValueInputs`
- Beide plekken (nieuw option + edit option) wisselen naar `DynamicValueInputs`
- Ref-interface blijft compatible (`commitPending()`)
- Verwijder hulptekst "Druk Enter na elke waarde"

### Visueel voorbeeld
```text
Waarden:
┌──────────────┐ ×
│ Rood         │
├──────────────┤ ×
│ Blauw        │
├──────────────┤
│              │  ← leeg veld, verschijnt automatisch
└──────────────┘
```

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/components/ui/dynamic-value-inputs.tsx` | Nieuw — dynamische invoervelden component |
| `src/components/admin/products/ProductVariantsTab.tsx` | Wijzigen — TagInput vervangen door DynamicValueInputs |


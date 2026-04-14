

# Variant waarden-invoer duidelijker maken

## Probleem
De `TagInput` is technisch al aanwezig, maar gebruikers herkennen het niet als een tag-invoer. Ze typen "Rood" en klikken direct op "Toevoegen" — maar de waarde is nog niet als tag bevestigd (Enter niet ingedrukt), waardoor `newOptionValues` leeg is en ze een foutmelding krijgen. De placeholder "bijv. Rood, Blauw, Groen" versterkt de verwarring.

## Aanpak

**Bestand:** `src/components/admin/products/ProductVariantsTab.tsx`

1. **Uncommitted tekst automatisch opvangen**: In `handleAddOption` en `handleUpdateOptionValues` de huidige (niet-bevestigde) invoertekst van de TagInput meenemen. Dit vereist een kleine aanpassing: een ref of callback toevoegen zodat de niet-bevestigde tekst ook als waarde wordt meegenomen bij klik op "Toevoegen".

2. **Placeholder verduidelijken**: Wijzigen naar `"Typ waarde + Enter"` — kort en duidelijk.

3. **Hulptekst onder het veld**: Kleine `text-muted-foreground text-xs` tekst: "Druk Enter na elke waarde om toe te voegen".

**Bestand:** `src/components/ui/tag-input.tsx`

4. **Commit-functie blootstellen**: Een `ref` (via `useImperativeHandle`) toevoegen met een `commitPending()` methode die de huidige invoertekst als tag toevoegt — zodat de parent dit kan aanroepen voordat hij de waarden uitleest.

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/components/ui/tag-input.tsx` | `forwardRef` + `commitPending()` methode toevoegen |
| `src/components/admin/products/ProductVariantsTab.tsx` | Bij "Toevoegen" pending tekst committen, placeholder + hulptekst aanpassen |


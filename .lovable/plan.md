

# Bulk selectie & acties in Assets-bibliotheek

## Wat
Checkbox-selectie toevoegen aan de asset-kaarten zodat tenants meerdere assets kunnen selecteren en in bulk kunnen bewerken (achtergrond verwijderen/wijzigen), verwijderen of downloaden — vergelijkbaar met hoe de productlijst bulk-bewerkingen afhandelt.

## Aanpak

**Bestand:** `src/components/admin/marketing/MediaAssetsLibrary.tsx`

### 1. Selectie-state & logica
- `selectedIds: Set<string>` state toevoegen
- "Alles selecteren" checkbox in de header
- Per `AssetCard`: checkbox linksboven die verschijnt bij hover of wanneer er al een selectie actief is

### 2. Zwevende bulk-actiebalk
Wanneer `selectedIds.size > 0`, verschijnt een zwevende balk onderaan (conform admin design standaard: `fixed bottom-14`) met:
- **Telling**: "X geselecteerd"
- **Achtergrond verwijderen** (AI-actie, kost credits) — verwerkt alle geselecteerde afbeeldingen sequentieel via `generateImage`
- **Achtergrond wijzigen** — opent een preset-kiezer (hergebruikt `BACKGROUND_PRESETS` uit `ImageEditorDialog`) en verwerkt daarna in bulk
- **Verwijderen** — alleen voor `source: 'upload'` assets
- **Downloaden** — URL's openen in nieuw tabblad
- **Deselecteren** knop

### 3. AssetCard aanpassing
- Nieuwe prop `selected: boolean` en `onSelect: () => void`
- Checkbox overlay linksboven, altijd zichtbaar wanneer `selectedIds.size > 0`, anders alleen op hover
- Klikken op de kaart zelf togglet selectie wanneer bulk-modus actief is

### 4. Bulk-verwerking met voortgang
- Bij AI-acties: sequentieel verwerken met een voortgangsindicator ("3 van 8 verwerkt...")
- Resilient pattern: individuele try/catch per afbeelding zodat een fout niet de rest blokkeert
- Samenvattend bericht na afloop ("5 van 6 succesvol bewerkt")

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/components/admin/marketing/MediaAssetsLibrary.tsx` | Wijzigen — selectie-state, checkbox in AssetCard, zwevende bulk-balk, bulk-verwerkingslogica |

## Wat er niet verandert
- Geen database-wijzigingen
- Bestaande individuele acties (favoriet, verwijderen, editor) blijven werken
- Upload-zone en folder-navigatie ongewijzigd


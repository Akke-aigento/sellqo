
# Sectie Editor Modal: Scroll + Afbeelding Upload Fix

## Problemen

1. **Geen scroll**: De `DialogContent` heeft geen `max-height` of `overflow-y: auto`, waardoor bij langere secties (hero, text+image, video) de content buiten het scherm valt en niet scrollbaar is.

2. **Geen afbeelding upload**: Het "Afbeelding URL" veld is een gewoon tekstveld waar je handmatig een URL moet plakken. Er is geen upload-knop of drag-and-drop. De `VisualMediaPicker` component (met Supabase Storage upload) bestaat al in het project maar wordt alleen gebruikt in de visuele editor, niet in de SectionEditor.

---

## Oplossing

### 1. DialogContent scrollbaar maken

In `HomepageBuilder.tsx` de `DialogContent` aanpassen met `max-h-[85vh] overflow-y-auto` zodat de modal altijd scrollbaar is op kleinere schermen.

### 2. Afbeelding URL velden vervangen door MediaPicker

In `SectionEditor.tsx` de bestaande `VisualMediaPicker` component hergebruiken voor alle afbeelding-velden:
- **Hero**: `image_url` veld wordt een upload zone met preview
- **Text+Image**: `image_url` veld wordt een upload zone
- **Video**: `poster_url` veld wordt een upload zone

De `VisualMediaPicker` biedt drag-and-drop, upload naar storage, en een preview van de huidige afbeelding. Hiermee kan de gebruiker direct een foto uploaden in plaats van een URL te moeten plakken.

---

## Technische wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/HomepageBuilder.tsx` | `DialogContent` krijgt `max-h-[85vh] overflow-y-auto` class |
| `src/components/admin/storefront/SectionEditor.tsx` | Import `VisualMediaPicker`, vervang `Input` velden voor `image_url` en `poster_url` door de media picker component |

### SectionEditor - Hero sectie (voorbeeld)

Het huidige "Afbeelding URL" `Input` veld wordt vervangen door:
- Een `VisualMediaPicker` component met `aspectRatio="video"` en een preview
- De URL wordt nog steeds opgeslagen in `content.image_url`, maar nu via upload in plaats van handmatig typen
- Optioneel blijft een klein URL-invoerveld beschikbaar als fallback voor externe URLs

### SectionEditor - Text+Image sectie

Zelfde aanpak: `Input` voor `image_url` wordt `VisualMediaPicker` met `aspectRatio="square"`.

### SectionEditor - Video sectie

Het `poster_url` veld (poster afbeelding) wordt ook een `VisualMediaPicker`.

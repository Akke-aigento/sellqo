

# Productfoto Bewerking & Centraal Fotobeheer

## Twee features

### 1. AI Achtergrond Bewerking — direct vanuit productfoto's
Shopify-achtige functionaliteit waarbij tenants een productfoto kunnen selecteren en:
- **Achtergrond verwijderen** (transparant maken)
- **Nieuwe achtergrond kiezen** uit presets (studio wit, gradient, lifestyle settings, seizoensgebonden, etc.)
- De bewerkte foto direct als productafbeelding opslaan of toevoegen

**Waar dit komt:**
- Een "Bewerk foto" knop bij elke productafbeelding in het productformulier (`ProductForm.tsx`)
- Opent een dialog met de originele foto + bewerkingsopties
- Gebruikt de bestaande `ai-generate-image` edge function (die al `background_remove` en `enhance` ondersteunt)
- Resultaat kan direct de productfoto vervangen of als extra afbeelding worden toegevoegd

**Nieuw component:** `src/components/admin/products/ImageEditorDialog.tsx`
- Toont originele foto links, preview rechts
- Knoppen: "Achtergrond verwijderen", "Achtergrond wijzigen" (met presets dropdown)
- "Toepassen" slaat de nieuwe afbeelding op naar het product

### 2. Centraal Fotobeheer — alle productfoto's op één plek
Een nieuwe tab/pagina waar tenants **alle productafbeeldingen** in één overzicht zien en in bulk kunnen bewerken.

**Waar dit komt:**
- Nieuwe tab "Foto's" in de bestaande `AIMarketingHub` (naast Assets), óf als eigen route
- Haalt alle producten op en toont hun afbeeldingen in een grid
- Per foto: productnaam erbij, klikbaar om te bewerken
- Bulk-selectie: meerdere foto's selecteren → achtergrond verwijderen/wijzigen in één keer
- Hergebruikt dezelfde `ImageEditorDialog` voor individuele bewerkingen

**Nieuw component:** `src/components/admin/products/ProductPhotosManager.tsx`
- Grid van alle productafbeeldingen met productnaam
- Checkbox-selectie voor bulk-acties
- Toolbar met "Achtergrond verwijderen" en "Achtergrond wijzigen" voor geselecteerde foto's
- Filter op: producten zonder foto, producten met foto, categorie

**Nieuwe route:** Toegevoegd als tab in het producten-overzicht of als sub-route

## Technische aanpak

### Bestanden

| Bestand | Actie |
|---------|-------|
| `src/components/admin/products/ImageEditorDialog.tsx` | **Nieuw** — AI foto-editor dialog |
| `src/components/admin/products/ProductPhotosManager.tsx` | **Nieuw** — Centraal fotobeheer grid |
| `src/pages/admin/Products.tsx` | **Wijzigen** — tab toevoegen voor "Foto's" |
| `src/pages/admin/ProductForm.tsx` | **Wijzigen** — "Bewerk" knop bij productafbeeldingen |
| `src/hooks/useAIImages.ts` | Hergebruiken — bestaande `generateImage` mutatie met `enhancementType: 'background_remove'` |

### Bestaande infrastructuur die hergebruikt wordt
- `ai-generate-image` edge function (al deployed, ondersteunt `background_remove`, `enhance`, `overlay`)
- `useAIImages` hook met `generateImage` mutatie
- `useAICredits` voor credit-checks
- `useProducts` voor het ophalen van alle producten + afbeeldingen
- Setting presets (studio, gradient, lifestyle, etc.) uit `AIImageGenerator.tsx`

### Wat er niet verandert
- Geen database-migraties nodig
- Geen nieuwe edge functions
- Credit-systeem blijft ongewijzigd

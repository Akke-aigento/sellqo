

## Nieuwe homepage secties: Categorieoverzicht + meer

### Probleem

Op de homepage ontbreekt een sectie om **categorieën visueel** te tonen. De bestaande "Collectie"-sectie toont producten *uit* één categorie, maar er is geen manier om een overzicht van alle (of geselecteerde) categorieën als aantrekkelijke kaarten te tonen waarmee klanten snel naar de juiste productgroep navigeren.

Daarnaast missen er een paar veelgebruikte e-commerce secties die de homepage completer en professioneler maken.

### Nieuwe secties

| Sectie | Beschrijving | Waarom |
|---|---|---|
| **Categorieën Grid** | Visueel raster van categorie-kaarten met afbeelding, naam en link | Klanten snel naar de juiste productgroep leiden |
| **USP Balk** | Rij met vertrouwenspunten (gratis verzending, retourbeleid, etc.) met iconen | Vertrouwen wekken, conversie verhogen |
| **CTA Banner** | Opvallend blok met achtergrondkleur/-afbeelding, tekst en actieknop | Promoties, seizoensacties, aanbiedingen |

### Technische aanpak

**1. Types uitbreiden (`src/types/storefront.ts`)**

- Drie nieuwe types toevoegen aan `HomepageSectionType`: `categories_grid`, `usp_bar`, `cta_banner`
- Nieuwe content interfaces:
  - `CategoriesGridContent`: `category_ids?: string[]`, `columns?: number`, `show_description?: boolean`, `show_product_count?: boolean`
  - `UspBarContent`: `items?: Array<{ icon: string, title: string, description?: string }>`
  - `CtaBannerContent`: `background_image?: string`, `button_text?: string`, `button_link?: string`, `background_color?: string`
- Toevoegen aan `HomepageSectionContent` union type
- Toevoegen aan `SECTION_TYPES` array met label, icoon en beschrijving

**2. Admin SectionEditor uitbreiden (`src/components/admin/storefront/SectionEditor.tsx`)**

- Drie nieuwe case-blokken in `renderContentFields()`:
  - **categories_grid**: Multi-select voor categorieën, kolom-keuze, toggles voor beschrijving/productaantal
  - **usp_bar**: Dynamische lijst van USP items met icoon-keuze, titel en beschrijving
  - **cta_banner**: Achtergrondafbeelding picker, knoptekst, link, achtergrondkleur

**3. Publieke sectie-componenten aanmaken (`src/components/storefront/sections/`)**

- `CategoriesGridSection.tsx`: Haalt categorieën op via bestaande hooks, toont als kaarten in een responsive grid met afbeelding, naam en optioneel beschrijving/productaantal. Linkt naar `/shop/{slug}/products?category={id}`
- `UspBarSection.tsx`: Horizontale balk met iconen en tekst, responsief (scrollbaar op mobiel)
- `CtaBannerSection.tsx`: Volledige-breedte banner met achtergrond, overlay, titel/subtitel en CTA-knop

**4. Homepage rendering bijwerken (`src/pages/storefront/ShopHome.tsx`)**

- Imports toevoegen voor de drie nieuwe componenten
- Cases toevoegen in de `renderSection` switch

**5. Mini-previews toevoegen (`src/components/admin/storefront/preview/MiniSections.tsx`)**

- `MiniCategoriesGrid`, `MiniUspBar`, `MiniCtaBanner` functies toevoegen
- Registreren in `renderMiniSection`

**6. Visuele editor secties (`src/components/admin/storefront/visual-editor/sections/`)**

- `EditableCategoriesGridSection.tsx`, `EditableUspBarSection.tsx`, `EditableCtaBannerSection.tsx` aanmaken
- Exporteren in `index.ts`

**7. Database migratie**

- De `homepage_sections.section_type` kolom moet de nieuwe waarden accepteren (als er een enum/check constraint is)

### Bestanden overzicht

| Bestand | Actie |
|---|---|
| `src/types/storefront.ts` | Types + SECTION_TYPES uitbreiden |
| `src/components/admin/storefront/SectionEditor.tsx` | Editor velden voor 3 nieuwe secties |
| `src/components/storefront/sections/CategoriesGridSection.tsx` | Nieuw: publieke categorie-grid |
| `src/components/storefront/sections/UspBarSection.tsx` | Nieuw: publieke USP balk |
| `src/components/storefront/sections/CtaBannerSection.tsx` | Nieuw: publieke CTA banner |
| `src/pages/storefront/ShopHome.tsx` | Rendering uitbreiden |
| `src/components/admin/storefront/preview/MiniSections.tsx` | Mini-previews toevoegen |
| `src/components/admin/storefront/visual-editor/sections/` | Editable versies toevoegen |
| `src/components/admin/storefront/visual-editor/VisualEditorCanvas.tsx` | Nieuwe secties registreren |
| Database migratie | Section type constraint bijwerken (indien nodig) |

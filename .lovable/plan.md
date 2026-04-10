

## Filters onthouden + floating save bar op productpagina

### Huidige situatie
- **Filters**: De filters in `Products.tsx` (zoektekst, status, zichtbaarheid, voorraad, categorie, viewMode) worden opgeslagen in gewone `useState` — bij navigatie naar een productpagina en terug worden ze gereset.
- **Floating save bar**: `ProductForm.tsx` heeft **al** een `FloatingSaveBar` component (regel 1770-1775). Deze verschijnt wanneer het formulier gewijzigd is. Dit deel is dus al geregeld.

### Plan

**Stap 1: Filters bewaren via sessionStorage**

In `src/pages/admin/Products.tsx`:
- De 5 filterwaarden (`search`, `statusFilter`, `visibilityFilter`, `stockFilter`, `categoryFilter`) en `viewMode` opslaan in `sessionStorage` onder een vaste key (bv. `admin-products-filters`).
- Bij mount: initiële waarden laden uit `sessionStorage` i.p.v. hardcoded defaults.
- Bij elke filterwijziging: sessionStorage updaten.
- `sessionStorage` verdwijnt automatisch bij het sluiten van de tab, dus filters worden niet permanent bewaard — precies wat je wilt.

Geen andere bestanden hoeven te wijzigen.

### Bestanden die wijzigen
- `src/pages/admin/Products.tsx` — filter-state koppelen aan sessionStorage

### Resultaat
- Als je vanuit het productoverzicht naar een productpagina navigeert en terugkeert, staan alle filters nog exact zoals je ze had ingesteld.
- Bij het sluiten van de tab of browser worden de filters automatisch gewist.
- De floating save bar werkt al op de productpagina — geen wijziging nodig.




## Varianten tonen in de rasterview (grid)

### Concept
Producten met varianten worden uitklapbaar in het grid. Een klein pijltje naast de productnaam laat zien dat er varianten zijn. Bij het uitklappen verschijnen de varianten als sub-rijen (licht ingesprongen, met lichtere achtergrond), met hun eigen bewerkbare velden: **titel, SKU, barcode, prijs, kostprijs, van-prijs, voorraad, gewicht, actief**.

```text
▼ "BLUE STORM" LUXE TEE  | ABC123 | €110  | 40 | ...
    S                     | -      | €110  | 10 | ...
    M                     | -      | €110  | 10 | ...
    L                     | -      | €110  | 10 | ...
    XL                    | -      | €110  | 10 | ...
▶ Diamond Silence Tee     | DEF456 | €110  | 40 | ...
```

### Wat er wijzigt

**Stap 1: Varianten ophalen in `ProductGridView.tsx`**
- Per product dat varianten heeft, de varianten ophalen via een enkele query op `product_variants` (gefilterd op de product IDs in de huidige gefilterde lijst + tenant).
- Bijhouden welke productrijen zijn uitgeklapt via een `expandedProducts` state (Set van product IDs).

**Stap 2: Sub-rijen renderen**
- Na elke productrij: als het product uitgeklapt is, de bijbehorende varianten als sub-rijen renderen.
- Sub-rijen krijgen een licht ingesprongen stijl en een subtiel andere achtergrondkleur.
- De cellen van een variant-rij gebruiken dezelfde cell-componenten (GridTextCell, GridNumberCell, etc.), maar schrijven naar een apart `variantPendingChanges` state.
- Kolommen die niet van toepassing zijn op varianten (zoals categorie, kanalen, tags) tonen een streepje.

**Stap 3: Opslaan van variant-wijzigingen**
- `handleSaveAll` uitbreiden: naast productwijzigingen ook variant-wijzigingen opslaan via `supabase.from('product_variants').update(...)`.

**Stap 4: Expand-indicator toevoegen**
- In de eerste kolom (rij-indicator): een chevron-icoontje tonen als het product varianten heeft. Klikken toggled de uitgeklapte staat.

### Bestanden die wijzigen
- `src/components/admin/products/grid/ProductGridView.tsx` — expand-logica, variant-rijen, variant-opslag
- `src/hooks/useProductGrid.ts` — variant pending changes state + save helper toevoegen
- `src/components/admin/products/grid/gridTypes.ts` — variant-specifieke kolom-mapping toevoegen

### Resultaat
- In de rasterview zie je direct welke producten varianten hebben
- Je kunt varianten uitklappen en inline hun prijs, voorraad, SKU etc. bewerken
- Wijzigingen aan varianten worden meegenomen in het opslaan


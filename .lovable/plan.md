

## Categorie multi-select in rasterweergave

### Probleem

De categorie-kolom in de grid is een single-select (`GridSelectCell`), maar producten ondersteunen meerdere categorieën via de `product_categories` junction-tabel. De data is er al (product heeft `product_categories` array), maar de grid toont/bewerkt alleen `category_id` (enkele waarde).

### Aanpak

**1. Nieuw cell-type: `multiselect`** — `gridTypes.ts`
- Nieuw CellType `'multiselect'` toevoegen
- `category_id` kolom wijzigen van type `'select'` naar `'multiselect'`

**2. Nieuw component: `GridMultiSelectCell.tsx`**
- Toont geselecteerde categorieën als comma-separated labels (of badges)
- Bij klikken opent een popover/dropdown met checkboxes voor alle categorieën
- Waarde is `string[]` (array van category IDs)
- Sluit na klikken buiten de popover

**3. `useProductGrid.ts` — `getCellValue` uitbreiden**
- Voor veld `category_id`: lees `product.product_categories` array en return `string[]` van category_ids (incl. `product.category_id` als fallback/primary)
- Pending changes slaat ook `string[]` op

**4. `ProductGridView.tsx` — Render multiselect**
- Nieuw case `'multiselect'` in `renderCell` die `GridMultiSelectCell` rendert met `categoryOptions`

**5. Save-logica aanpassen**
- In `handleSaveAll`: als een change voor `category_id` een `string[]` is, upsert naar `product_categories` junction-tabel (delete bestaande + insert nieuwe)
- Zet `category_id` op de eerste (primary) categorie, of `null` als leeg

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/products/grid/gridTypes.ts` | `multiselect` type + kolom aanpassen |
| `src/components/admin/products/grid/GridMultiSelectCell.tsx` | Nieuw — multi-select cell met checkboxes |
| `src/components/admin/products/grid/ProductGridView.tsx` | Render multiselect + save via junction-tabel |
| `src/hooks/useProductGrid.ts` | `getCellValue` voor category_id → array |

### Geen database wijzigingen nodig


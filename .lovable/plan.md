

## Checkboxes toevoegen aan de Grid-weergave voor bulkselectie

### Probleem
De grid-weergave (spreadsheet-stijl) heeft alleen cel-selectie maar geen rij-selectie met checkboxes. Hierdoor kun je geen producten selecteren voor bulkacties (bewerken, verwijderen, activeren) zoals in de lijstweergave wel kan.

### Aanpak

**`src/components/admin/products/grid/ProductGridView.tsx`**
1. Props uitbreiden met `selectedIds`, `onToggleSelect`, `onToggleSelectAll` (hergebruik bestaande state uit Products.tsx)
2. Checkbox-kolom toevoegen links van de rijnummer-kolom:
   - Header: select-all checkbox
   - Per rij: individuele checkbox
3. Wanneer rijen geselecteerd zijn, de bestaande bulk-actie balk in Products.tsx wordt automatisch zichtbaar (die werkt al op `selectedIds`)

**`src/pages/admin/Products.tsx`**
1. `selectedIds`, `toggleSelect`, `toggleSelectAll` doorgeven als props aan `ProductGridView`
2. De bulk-actiebalk (regel 431-458) werkt al voor beide views — geen wijziging nodig

### Technisch detail
- De checkbox-kolom komt links van de bestaande "rijnummer" kolom (de smalle 40px kolom)
- Shift+click voor range-selectie wordt ondersteund
- De cel-selectie (voor inline editing) blijft onafhankelijk werken van de rij-selectie

### Bestanden
- `src/components/admin/products/grid/ProductGridView.tsx` — checkbox kolom + props
- `src/pages/admin/Products.tsx` — props doorgeven aan GridView


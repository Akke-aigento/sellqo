
# Plan: Product Spreadsheet Grid View

## Concept

Een **spreadsheet-achtige rasterweergave** voor producten waar je:
- Direct in cellen kunt klikken en waarden bewerken (inline editing)
- Meerdere cellen kunt selecteren met Shift+Click of slepen
- Geselecteerde cellen bulk kunt bewerken
- Alle wijzigingen kunt zien voordat je opslaat
- Met Tab/Enter door cellen kunt navigeren

Dit is vergelijkbaar met hoe Shopify en WooCommerce hun "Quick Edit" of "Bulk Edit" weergave hebben, maar dan nog krachtiger.

## Visueel Ontwerp

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Producten                                                           [Lijst] [Raster] [+ Nieuw] │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─ KOLOM CONFIGURATIE ─┐   Zoeken: [____________________]   [Filters ▾]                       │
│  │ ☑ Naam               │                                                                      │
│  │ ☑ SKU                │   ┌────────────────────────────────────────────────────────────────┐ │
│  │ ☑ Prijs              │   │ 3 cellen geselecteerd              [Bulk bewerken] [Wissen]    │ │
│  │ ☑ Voorraad           │   └────────────────────────────────────────────────────────────────┘ │
│  │ ☐ Kostprijs          │                                                                      │
│  │ ☑ Categorie          │                                                                      │
│  │ ☐ BTW                │                                                                      │
│  │ ☑ Status             │                                                                      │
│  │ ☐ Tags               │                                                                      │
│  └──────────────────────┘                                                                      │
│                                                                                                 │
│  ┌─────┬───────────────────────────┬──────────┬───────────┬─────────┬─────────────┬──────────┐ │
│  │  ☐  │ Naam                      │ SKU      │ Prijs     │ Voorrad │ Categorie   │ Status   │ │
│  ├─────┼───────────────────────────┼──────────┼───────────┼─────────┼─────────────┼──────────┤ │
│  │ ☐   │ iPhone 15 Pro Max         │ IPH-15PM │ €1.299,00 │   45    │ Telefoons   │  ● Actf  │ │
│  ├─────┼───────────────────────────┼──────────┼───────────┼─────────┼─────────────┼──────────┤ │
│  │ ☐   │ Samsung Galaxy S24        │ SAM-S24  │ [€999,00] │  [32]   │ Telefoons   │  ● Actf  │ │
│  ├─────┼───────────────────────────┼──────────┼───────────┼─────────┼─────────────┼──────────┤ │
│  │ ☐   │ MacBook Pro 16"           │ MBP-16   │ [€2.899,] │   12    │ Laptops     │  ○ Inact │ │
│  ├─────┼───────────────────────────┼──────────┼───────────┼─────────┼─────────────┼──────────┤ │
│  │ ☐   │ AirPods Pro 2             │ APP-2    │ €279,00   │  156    │ Accessoires │  ● Actf  │ │
│  └─────┴───────────────────────────┴──────────┴───────────┴─────────┴─────────────┴──────────┘ │
│                                                                                                 │
│  Wijzigingen (3):                                                                               │
│  ├─ Samsung Galaxy S24: Prijs €999,00 → €899,00, Voorraad 32 → 50                              │
│  └─ MacBook Pro 16": Prijs €2.899,00 → €2.499,00                                               │
│                                                                                                 │
│                                                      [Annuleren]  [Alle wijzigingen opslaan]   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Kernfunctionaliteiten

### 1. Inline Cel Bewerking
- Klik op een cel om te bewerken
- Enter of Tab om op te slaan en naar volgende cel
- Escape om te annuleren
- Automatische validatie (bijv. prijs moet getal zijn)

### 2. Multi-Cel Selectie
- Shift+Click voor range selectie
- Ctrl/Cmd+Click voor individuele cellen toevoegen
- Sleep selectie voor rechthoekige selectie
- Geselecteerde cellen krijgen highlight

### 3. Bulk Cel Bewerking
- Na selectie van meerdere cellen van hetzelfde type (bijv. 5 prijscellen)
- "Bulk bewerken" knop verschijnt
- Dezelfde opties als de bulk edit dialog (vast bedrag, percentage, etc.)
- Wijzigingen worden toegepast op alle geselecteerde cellen

### 4. Wijzigingen Tracking
- Gewijzigde cellen krijgen visuele indicator (gele achtergrond)
- Panel onderaan toont alle pending wijzigingen
- "Opslaan" slaat alles tegelijk op
- "Annuleren" zet alles terug naar origineel

### 5. Kolom Configuratie
- Kies welke kolommen zichtbaar zijn
- Sleep kolommen om volgorde te wijzigen (optioneel)
- Voorkeuren worden opgeslagen in localStorage

## Bewerkbare Velden

| Kolom | Type | Inline Edit | Bulk Edit |
|-------|------|-------------|-----------|
| Naam | Text | ✅ Direct typen | ❌ |
| SKU | Text | ✅ Direct typen | ❌ |
| Prijs | Number | ✅ Direct typen | ✅ +/- bedrag, % |
| Kostprijs | Number | ✅ Direct typen | ✅ Exact |
| Doorstreepprijs | Number | ✅ Direct typen | ✅ Verwijderen, exact |
| Voorraad | Number | ✅ Direct typen | ✅ +/- aantal, exact |
| Categorie | Select | ✅ Dropdown | ✅ Kiezen |
| BTW-tarief | Select | ✅ Dropdown | ✅ Kiezen |
| Status | Toggle | ✅ Switch | ✅ Aan/Uit |
| Featured | Toggle | ✅ Switch | ✅ Aan/Uit |
| Tags | Multi | ✅ Tag editor | ✅ Toevoegen/verwijderen |

## Technische Implementatie

### Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `src/components/admin/products/grid/ProductGridView.tsx` | Hoofdcomponent met spreadsheet logica |
| `src/components/admin/products/grid/GridCell.tsx` | Individuele bewerkbare cel |
| `src/components/admin/products/grid/GridTextCell.tsx` | Tekst input cel |
| `src/components/admin/products/grid/GridNumberCell.tsx` | Numerieke cel met formatting |
| `src/components/admin/products/grid/GridSelectCell.tsx` | Dropdown selectie cel |
| `src/components/admin/products/grid/GridToggleCell.tsx` | Boolean toggle cel |
| `src/components/admin/products/grid/GridTagsCell.tsx` | Tags editor cel |
| `src/components/admin/products/grid/ColumnConfig.tsx` | Kolom zichtbaarheid configuratie |
| `src/components/admin/products/grid/CellBulkEditor.tsx` | Bulk edit popup voor geselecteerde cellen |
| `src/components/admin/products/grid/ChangesPanel.tsx` | Panel met pending wijzigingen |
| `src/hooks/useProductGrid.ts` | State management voor grid (selectie, wijzigingen, etc.) |

### State Management

```typescript
interface GridState {
  // Welke cellen zijn geselecteerd: Map<productId, Set<fieldName>>
  selectedCells: Map<string, Set<string>>;
  
  // Pending wijzigingen: Map<productId, Map<fieldName, newValue>>
  pendingChanges: Map<string, Map<string, unknown>>;
  
  // Momenteel actieve cel voor editing
  editingCell: { productId: string; field: string } | null;
  
  // Zichtbare kolommen
  visibleColumns: string[];
  
  // Kolom volgorde
  columnOrder: string[];
}
```

### Cel Types

```typescript
type CellType = 
  | 'text'      // Vrije tekst input
  | 'number'    // Numeriek met formatting
  | 'currency'  // Prijs met € symbool
  | 'select'    // Dropdown met opties
  | 'toggle'    // Boolean switch
  | 'tags'      // Multi-tag editor
  | 'readonly'; // Niet bewerkbaar

interface ColumnDefinition {
  field: keyof Product;
  header: string;
  type: CellType;
  width: number;
  editable: boolean;
  bulkEditable: boolean;
  options?: { value: string; label: string }[]; // Voor select type
  format?: (value: unknown) => string;
  validate?: (value: unknown) => boolean | string;
}
```

### Kolom Definities

```typescript
const GRID_COLUMNS: ColumnDefinition[] = [
  { field: 'name', header: 'Naam', type: 'text', width: 250, editable: true, bulkEditable: false },
  { field: 'sku', header: 'SKU', type: 'text', width: 120, editable: true, bulkEditable: false },
  { field: 'price', header: 'Prijs', type: 'currency', width: 100, editable: true, bulkEditable: true },
  { field: 'cost_price', header: 'Kostprijs', type: 'currency', width: 100, editable: true, bulkEditable: true },
  { field: 'compare_at_price', header: 'Van-prijs', type: 'currency', width: 100, editable: true, bulkEditable: true },
  { field: 'stock', header: 'Voorraad', type: 'number', width: 80, editable: true, bulkEditable: true },
  { field: 'category_id', header: 'Categorie', type: 'select', width: 150, editable: true, bulkEditable: true },
  { field: 'vat_rate_id', header: 'BTW', type: 'select', width: 100, editable: true, bulkEditable: true },
  { field: 'is_active', header: 'Actief', type: 'toggle', width: 70, editable: true, bulkEditable: true },
  { field: 'is_featured', header: 'Uitgelicht', type: 'toggle', width: 80, editable: true, bulkEditable: true },
  { field: 'tags', header: 'Tags', type: 'tags', width: 200, editable: true, bulkEditable: true },
  { field: 'barcode', header: 'Barcode', type: 'text', width: 120, editable: true, bulkEditable: false },
  { field: 'weight', header: 'Gewicht', type: 'number', width: 80, editable: true, bulkEditable: true },
];
```

## View Toggle in Products Page

De Products pagina krijgt een view toggle:

```text
[Lijst]  [Raster]  [+ Nieuw product]
  ↓         ↓
Huidige   Nieuwe
tabel     spreadsheet
view      view
```

### Updated Products.tsx

```typescript
const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

return (
  <>
    <div className="flex items-center gap-2">
      <ToggleGroup type="single" value={viewMode} onValueChange={setViewMode}>
        <ToggleGroupItem value="list" aria-label="Lijstweergave">
          <List className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Rasterweergave">
          <Grid3X3 className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    
    {viewMode === 'list' ? (
      <ProductTable ... />  {/* Huidige tabel */}
    ) : (
      <ProductGridView products={filteredProducts} />
    )}
  </>
);
```

## Keyboard Navigatie

| Toets | Actie |
|-------|-------|
| Enter | Bewerk huidige cel / Sla op en ga naar cel eronder |
| Tab | Sla op en ga naar volgende cel |
| Shift+Tab | Sla op en ga naar vorige cel |
| Escape | Annuleer bewerking |
| Pijltjes | Navigeer tussen cellen (als niet in edit mode) |
| Ctrl/Cmd+S | Sla alle wijzigingen op |
| Ctrl/Cmd+Z | Undo laatste wijziging |

## Cel Selectie Logica

```typescript
// Shift+Click: Range selectie
const handleShiftClick = (productId: string, field: string) => {
  // Selecteer alle cellen tussen lastSelected en huidige
  const startRow = products.findIndex(p => p.id === lastSelected.productId);
  const endRow = products.findIndex(p => p.id === productId);
  const [minRow, maxRow] = [Math.min(startRow, endRow), Math.max(startRow, endRow)];
  
  for (let i = minRow; i <= maxRow; i++) {
    addToSelection(products[i].id, field);
  }
};

// Ctrl/Cmd+Click: Toggle individuele cel
const handleCtrlClick = (productId: string, field: string) => {
  toggleSelection(productId, field);
};
```

## Bulk Cel Bewerking

Wanneer meerdere cellen van hetzelfde veld type zijn geselecteerd:

```text
┌─────────────────────────────────────────────────────┐
│  5 prijscellen geselecteerd                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Aanpassing type:                                   │
│  ○ Vast bedrag toevoegen     [€____]               │
│  ○ Vast bedrag aftrekken     [€____]               │
│  ○ Percentage verhogen       [___]%                │
│  ○ Percentage verlagen       [___]%                │
│  ● Exacte waarde             [€999,00]             │
│                                                     │
│                 [Annuleren]  [Toepassen]            │
└─────────────────────────────────────────────────────┘
```

## Wijzigingen Panel

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Wijzigingen (5)                                                [Alles wissen] │
├─────────────────────────────────────────────────────────────────────────────┤
│  📦 Samsung Galaxy S24                                                      │
│     └─ Prijs: €999,00 → €899,00                                            │
│     └─ Voorraad: 32 → 50                                                   │
│                                                                             │
│  📦 MacBook Pro 16"                                                         │
│     └─ Prijs: €2.899,00 → €2.499,00                                        │
│     └─ Status: Inactief → Actief                                           │
│                                                                             │
│  📦 AirPods Pro 2                                                           │
│     └─ Categorie: Accessoires → Audio                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                        [Annuleren]  [Alle wijzigingen opslaan] │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `ProductGridView.tsx` | Nieuw | Hoofdcomponent spreadsheet |
| `GridCell.tsx` | Nieuw | Base cell component |
| `GridTextCell.tsx` | Nieuw | Text input cel |
| `GridNumberCell.tsx` | Nieuw | Number/currency cel |
| `GridSelectCell.tsx` | Nieuw | Dropdown cel |
| `GridToggleCell.tsx` | Nieuw | Boolean toggle cel |
| `GridTagsCell.tsx` | Nieuw | Tags editor cel |
| `ColumnConfig.tsx` | Nieuw | Kolom configuratie popover |
| `CellBulkEditor.tsx` | Nieuw | Bulk edit voor geselecteerde cellen |
| `ChangesPanel.tsx` | Nieuw | Pending changes overzicht |
| `useProductGrid.ts` | Nieuw | Grid state management hook |
| `Products.tsx` | Update | View toggle toevoegen |

## Resultaat

Na implementatie heeft de merchant:

1. **Spreadsheet-achtige interface** - Vertrouwd voor iedereen die Excel kent
2. **Snelle inline editing** - Klik en type, geen popups nodig
3. **Multi-cel selectie** - Shift/Ctrl+Click zoals in Excel
4. **Bulk cel bewerking** - Selecteer 10 prijscellen, pas allemaal tegelijk aan
5. **Visuele wijzigingen tracking** - Zie precies wat er gaat veranderen
6. **Batch opslaan** - Alle wijzigingen in één keer naar de database
7. **Keyboard navigatie** - Tab, Enter, pijltjes voor power users

Dit combineert het beste van beide werelden:
- **Huidige bulk dialog**: Voor grote operaties op hele producten
- **Nieuwe grid view**: Voor snelle, gerichte aanpassingen aan specifieke velden

De merchant kan nu bijvoorbeeld:
- Snel door 100 producten gaan en hier en daar een prijs aanpassen
- 20 prijscellen selecteren en allemaal 10% verhogen
- Zien welke wijzigingen pending zijn voordat ze worden opgeslagen
- Met keyboard snel navigeren zoals in een spreadsheet

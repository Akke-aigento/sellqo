

## Fix: Scroll in Bulk bewerking modal

### Probleem
De `DialogContent` gebruikt `grid` layout (uit dialog.tsx), maar de `ProductBulkEditDialog` gebruikt `flex flex-col` met `overflow-hidden`. Het probleem is dat flex children binnen een grid container niet correct krimpen — de `flex-1 overflow-y-auto` div krijgt geen beperkte hoogte en kan dus niet scrollen.

### Fix

**`src/components/admin/products/ProductBulkEditDialog.tsx`**

1. De scrollable content div (`flex-1 overflow-y-auto`) heeft `min-h-0` nodig zodat flex shrink werkt
2. De `Tabs` wrapper heeft ook `min-h-0` nodig
3. Voeg een expliciete `min-h-0` toe aan de `DialogContent` className zodat de hele flex-col chain correct krimpt

Concrete wijziging op regel 90:
```
max-w-2xl max-h-[85vh] overflow-hidden flex flex-col
→ max-w-2xl max-h-[85vh] overflow-hidden flex flex-col min-h-0
```

Regel 98 (Tabs):
```
className="flex-1 overflow-hidden flex flex-col"
→ className="flex-1 overflow-hidden flex flex-col min-h-0"
```

Regel 109 (scroll container):
```
className="flex-1 overflow-y-auto mt-4 pr-2"
→ className="flex-1 overflow-y-auto mt-4 pr-2 min-h-0"
```

### Bestanden
- `src/components/admin/products/ProductBulkEditDialog.tsx` — 3 regels `min-h-0` toevoegen


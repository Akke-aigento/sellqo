## POS Systeem: Grondige Refactor ✅

### Wat is gewijzigd

1. **Layout fix** – QuickButtonDialog verbreed naar `max-w-3xl`, zoekresultaten hebben `truncate` + `shrink-0` op prijzen
2. **Categorie-navigatie** – Nieuw `POSProductPanel.tsx` met horizontale categorie-chips, subcategorieën breadcrumb, en productgrid
3. **BTW per product** – Dynamische tax_rate per cart-item via `vat_rate_id` lookup, met fallback naar terminal `defaultTaxRate`
4. **Barcode generatie** – `ProductBarcodeDialog.tsx` met JsBarcode (EAN-13, CODE128, etc.), download PNG, printen labels
5. **Hardware setup help** – Scanner/printer/kaslade instructies + testprint & kaslade-test knoppen in terminal settings
6. **Refactor POSTerminal** – Gesplitst in `POSProductPanel`, `POSCartPanel`, `usePOSCart` hook. Terminal van ~1500 naar gestructureerde componenten
7. **BTW breakdown** – Cart toont per-tarief BTW regels als er meerdere tarieven in de winkelwagen zitten

### Nieuwe bestanden
- `src/hooks/usePOSCart.ts` – Cart state management met per-item tax rates
- `src/components/admin/pos/POSProductPanel.tsx` – Zoek, categorieën, productgrid
- `src/components/admin/pos/POSCartPanel.tsx` – Winkelwagen met BTW breakdown
- `src/components/admin/products/ProductBarcodeDialog.tsx` – Barcode generatie dialog

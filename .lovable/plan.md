## POS Systeem: Grondige Refactor ✅

### Wat is gewijzigd

1. **Layout fix** – QuickButtonDialog verbreed naar `max-w-3xl`, zoekresultaten hebben `truncate` + `shrink-0` op prijzen
2. **Categorie-navigatie** – Nieuw `POSProductPanel.tsx` met horizontale categorie-chips, subcategorieën breadcrumb, en productgrid
3. **BTW per product** – Dynamische tax_rate per cart-item via `vat_rate_id` lookup, met fallback naar terminal `defaultTaxRate`
4. **Barcode generatie** – `ProductBarcodeDialog.tsx` met JsBarcode (EAN-13, CODE128, etc.), download PNG, printen labels
5. **Hardware setup help** – Scanner/printer/kaslade instructies + testprint & kaslade-test knoppen in terminal settings
6. **Refactor POSTerminal** – Gesplitst in `POSProductPanel`, `POSCartPanel`, `usePOSCart` hook. Terminal van ~1500 naar gestructureerde componenten
7. **BTW breakdown** – Cart toont per-tarief BTW regels als er meerdere tarieven in de winkelwagen zitten

## POS → Orders Integratie ✅

### Wat is gewijzigd

1. **POS-transacties worden nu als orders opgeslagen** – Na elke voltooide POS-verkoop wordt automatisch een `orders` + `order_items` record aangemaakt
2. **Sales channel kolom** – `sales_channel` TEXT kolom toegevoegd aan `orders` tabel (default: 'webshop'). Backfill van bestaande orders op basis van `marketplace_source`
3. **Verkoopkanaal badge** – `OrderMarketplaceBadge` toont nu "POS" badge (groen) naast bestaande bronnen
4. **Verkoopkanaal filter** – OrderFilters component heeft nu een "Verkoopkanaal" dropdown (Alle kanalen / Webshop / POS / Bol.com / Amazon)
5. **Dashboard statistieken** – POS-omzet wordt automatisch meegenomen in `useOrderStats` en alle rapportages

### Bestanden gewijzigd
- `src/hooks/usePOS.ts` – Order + order_items aanmaken na POS transactie, order cache invalideren
- `src/types/order.ts` – `sales_channel` + `SalesChannel` type toegevoegd
- `src/hooks/useOrders.ts` – Filter op `sales_channel`
- `src/components/admin/OrderFilters.tsx` – Verkoopkanaal filter i.p.v. marketplace bron
- `src/components/admin/marketplace/OrderMarketplaceBadge.tsx` – POS badge + salesChannel prop
- `src/pages/admin/Orders.tsx` – salesChannel doorgeven aan badge
- Database migratie: `ALTER TABLE orders ADD COLUMN sales_channel TEXT DEFAULT 'webshop'`

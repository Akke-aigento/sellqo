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

## Kassa-medewerkers met PIN-code ✅

### Wat is gewijzigd

1. **Database** – `pos_cashiers` tabel met `pin_hash` (bcrypt via pgcrypto), `display_name`, `avatar_color`, `is_active`. DB functions: `create_pos_cashier`, `verify_cashier_pin`, `update_cashier_pin`, `hash_cashier_pin`. Nieuwe kolom `pos_cashier_id` op `pos_transactions`.
2. **Hook** – `usePOSCashiers.ts` met CRUD + `verifyPin` (roept DB function aan, hash gaat nooit naar client)
3. **PIN-select UI** – `POSCashierSelect.tsx`: avatar-grid met namen → 4-digit PIN invoer (auto-submit), terug-knop, foutmelding
4. **Admin beheer** – `CashierManagement.tsx` in TeamSettings: aanmaken (naam + PIN + kleur), bewerken, PIN wijzigen, activeren/deactiveren
5. **POS integratie** – `POSTerminal.tsx` toont cashier-select na sessie-open (als cashiers bestaan). Actieve medewerker in cart header met wissel-optie. `pos_cashier_id` wordt meegestuurd bij elke transactie.
6. **Backwards compatible** – Geen cashiers aangemaakt? Alles werkt zoals voorheen.

### Bestanden
- `src/hooks/usePOSCashiers.ts` (nieuw)
- `src/components/admin/pos/POSCashierSelect.tsx` (nieuw)
- `src/components/admin/settings/CashierManagement.tsx` (nieuw)
- `src/components/admin/settings/TeamSettings.tsx` (gewijzigd)
- `src/pages/admin/POSTerminal.tsx` (gewijzigd)
- `src/hooks/usePOS.ts` (gewijzigd)
- `src/components/admin/pos/POSCartPanel.tsx` (gewijzigd)

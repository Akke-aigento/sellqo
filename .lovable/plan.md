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

## Rapportage Uitbreiding: Boekhoudersdroomland ✅

### Wat is gewijzigd

1. **Winst & Verlies overzicht** – Omzet (facturen paid) minus inkoop (supplier docs) minus verzendkosten = bruto marge per maand met totaalrij
2. **Omzet per BTW-tarief** – Uitsplitsing per tarief (21%, 12%, 6%, 0%) met maatstaf, BTW bedrag en aantal orders
3. **Omzet per Verkoopkanaal** – Webshop vs POS vs Marketplace: omzet, orders, gem. orderbedrag, % van totaal
4. **Betalingsoverzicht** – Alle ontvangen betalingen (facturen + POS) met datum, methode, referentie — reconciliatie-rapport voor bankafschriften
5. **Marge-analyse per Product** – Per product: verkoopprijs, kostprijs, marge (€ + %), aantal verkocht, totale marge, gesorteerd op marge%
6. **Voorraadwaardering** – Voorraad × kostprijs per product met totaalrij — balanspost voor elk kwartaal
7. **Kassasessies (verrijkt)** – Sessies met omzet per sessie, aantal transacties, medewerker, sessieduur, contant/PIN split
8. **Jaarafsluiting Pakket** – Multi-sheet Excel: W&V, BTW per kwartaal, voorraadwaardering, klantenbestand — alles in één bestand
9. **BTW Kwartaal Pakket** – Automatisch huidig kwartaal: BTW-overzicht + IC-listing + betalingen

### Bestanden
- `src/hooks/useAccountingExports.ts` (nieuw — 9 hooks)
- `src/pages/admin/Reports.tsx` (gewijzigd — nieuwe ReportCards + imports)

## Rapportage Fase 2: Boekhoudersdroomland Pro ✅

### Wat is gewijzigd

1. **Grootboekjournaal** – Debet/credit journaalposten voor facturen, POS-transacties en inkoopfacturen met MAR-rekeningnummers (400000, 700000, 451000, 604000, 440000, 570000)
2. **Dagboek Verkopen** – Chronologisch verkoopfactuurjournaal met klant, BTW-nr, OGM, betaalstatus
3. **Dagboek Aankopen** – Chronologisch inkoopjournaal met leverancier, BTW-nr, vervaldatum, betaalstatus
4. **Debiteuren Subledger** – Openstaande posten per klant met verouderingsanalyse (0-30, 31-60, 61-90, 90+ dagen)
5. **Crediteuren Subledger** – Openstaande posten per leverancier met verouderingsanalyse
6. **Cashflow Overzicht** – Inkomend vs uitgaand geld per week met cumulatief saldo
7. **Belgische Klantenlisting** – Jaarlijkse B2B klantenlisting (≥€250) voor FOD Financiën
8. **Export naar Boekhoudpakket** – Exact Online en Octopus CSV importbestanden met juiste dagboekcodes en rekeningnummers
9. **Nieuwe "Boekhouding" tab** – Alle journalen en subledgers in eigen tab + software-exportknoppen

### Bestanden
- `src/hooks/useAccountingExports.ts` (uitgebreid — 8 nieuwe hooks)
- `src/pages/admin/Reports.tsx` (gewijzigd — nieuwe tab + ReportCards)

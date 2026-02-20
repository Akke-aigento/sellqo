
# Mobiel en Tablet Optimalisatie: Alle Bestellingen-pagina's

## Overzicht

Alle pagina's onder het "Bestellingen"-menu worden geoptimaliseerd voor mobiel (< 768px) en tablet (768px - 1024px). De aanpassingen volgen een consistent patroon: tabellen worden op kleine schermen vervangen door kaartweergaven, knoppen worden compacter, en headers/filters worden gestapeld.

## Pagina's die aangepast worden

### 1. Orders.tsx (Bestellingen overzicht)
**Huidige problemen:** Tabel met `min-w-[700px]` forceert horizontaal scrollen op mobiel/tablet.

**Wijzigingen:**
- Op mobiel/tablet: tabel vervangen door een kaartweergave per bestelling (ordernummer, klant, status, bedrag als compacte kaart)
- Checkbox-selectie behouden als swipe of compact checkbox bovenaan de kaart
- Desktop: tabel blijft ongewijzigd

### 2. OrderDetail.tsx (Bestelling detail)
**Huidige problemen:** Header met knoppen en badges loopt uit; 3-koloms grid past niet op tablet; klant-sectie met 2 knoppen naast elkaar wordt te krap.

**Wijzigingen:**
- Header: badges onder de titel wrappen, niet naast elkaar forceren
- Grid `md:grid-cols-3` wijzigen naar `lg:grid-cols-3` zodat tablet single-column krijgt
- Klant-sectie: knoppen onder de klantinfo stapelen op kleine schermen
- Adres grid `grid-cols-2` naar `grid-cols-1` op mobiel

### 3. Quotes.tsx (Offertes overzicht)
**Huidige problemen:** Tabel zonder `min-w` of responsieve kolom-hiding; alle 7 kolommen altijd zichtbaar.

**Wijzigingen:**
- Kolommen "Geldig tot" en "Datum" verbergen op mobiel (`hidden sm:table-cell`)
- Tabel wrappen met `overflow-x-auto` en `min-w-[600px]`
- Of: op mobiel kaartweergave tonen

### 4. QuoteDetail.tsx (Offerte detail)
**Huidige problemen:** Header met knoppen op 1 rij past niet op mobiel; actieknoppen lopen uit.

**Wijzigingen:**
- Header: titel en knoppen stapelen op mobiel (flex-col op kleine schermen)
- Knoppen wrappen op tablet/mobiel
- `lg:grid-cols-3` is al correct, geen wijziging nodig daar

### 5. QuoteForm.tsx (Offerte formulier)
**Huidige problemen:** Sidebar en content naast elkaar op tablet is te krap.

**Wijzigingen:**
- Grid `lg:grid-cols-3` is al goed -- geen wijziging nodig
- Header tekst `text-3xl` verkleinen op mobiel naar `text-xl sm:text-3xl`

### 6. Invoices.tsx (Facturen)
**Huidige problemen:** Tabel met `min-w-[750px]` en 9 kolommen; acties-kolom met meerdere icon-buttons loopt uit.

**Wijzigingen:**
- Meer kolommen verbergen op mobiel (Peppol, Bron, Order al verborgen -- Datum ook verbergen op xs)
- Peppol-filter sectie compacter op mobiel
- Actie-knoppen in een dropdown menu wrappen op mobiel

### 7. CreditNotes.tsx (Creditnota's)
**Huidige problemen:** Tabel zonder overflow-x-auto, 8 kolommen altijd zichtbaar, geen responsieve hiding.

**Wijzigingen:**
- `overflow-x-auto` toevoegen aan CardContent
- Kolommen "Originele factuur", "Type" en "Datum" verbergen op mobiel (`hidden sm:table-cell` / `hidden md:table-cell`)
- `min-w-[600px]` wrapper toevoegen

### 8. PurchaseOrders.tsx (Inkooporders)
**Huidige problemen:** Tabel met 7 kolommen zonder responsieve hiding; filters met 3 select-elementen naast elkaar.

**Wijzigingen:**
- Filters: op mobiel onder elkaar stapelen (al deels gedaan met `flex-col sm:flex-row`)
- Select breedtes op mobiel `w-full` maken (nu fixed `w-[180px]`/`w-[200px]`)
- Tabelkolommen "Orderdatum" en "Verwachte levering" verbergen op mobiel (`hidden sm:table-cell`)
- `overflow-x-auto` en `min-w` toevoegen
- Stats grid `md:grid-cols-4` naar `grid-cols-2 md:grid-cols-4`

### 9. Fulfillment.tsx (Verzendingen)
**Huidige problemen:** Tabel al redelijk responsief maar acties-kolom met 2 knoppen naast elkaar te breed op mobiel.

**Wijzigingen:**
- Actie-knoppen: op mobiel stapelen of in dropdown zetten
- Tracking dialog al responsief (Dialog component)

### 10. Payments.tsx (Betalingen)
**Huidige problemen:** Stats grid op 4 kolommen; TabsList horizontaal scrollen nodig; Payouts tabel zonder min-width.

**Wijzigingen:**
- Stats grid: `grid-cols-2 lg:grid-cols-4` (al `md:grid-cols-2 lg:grid-cols-4`, aanpassen)
- TabsList: scrollbaar maken op mobiel
- Payouts tabel: `overflow-x-auto` en `min-w` toevoegen
- Header `text-3xl` naar `text-xl sm:text-3xl`

### 11. Subscriptions.tsx (Abonnementen)
**Huidige problemen:** Tabel met `min-w-[700px]` en 7 kolommen; filter in CardHeader naast title.

**Wijzigingen:**
- Filter: op mobiel onder de titel plaatsen (flex-col)
- Kolommen "Facturatie cyclus" en "Volgende factuur" verbergen op mobiel

## Technische aanpak (consistent patroon)

Alle pagina's volgen dezelfde strategie:
1. **Headers**: `text-xl sm:text-2xl` of `text-xl sm:text-3xl` voor titels; knoppen wrappen met `flex-wrap`
2. **Filters**: `flex-col sm:flex-row` met `w-full sm:w-[180px]` voor selects
3. **Tabellen**: `overflow-x-auto` op container, kolommen verbergen met `hidden sm:table-cell` / `hidden md:table-cell`
4. **Stats grids**: `grid-cols-2 md:grid-cols-4`
5. **Detail grids**: `lg:grid-cols-3` in plaats van `md:grid-cols-3`
6. **Knoppen in headers**: `flex-wrap gap-2` zodat ze op een nieuwe rij vallen

## Bestanden die wijzigen

- `src/pages/admin/Orders.tsx`
- `src/pages/admin/OrderDetail.tsx`
- `src/pages/admin/Quotes.tsx`
- `src/pages/admin/QuoteDetail.tsx`
- `src/pages/admin/QuoteForm.tsx`
- `src/pages/admin/Invoices.tsx`
- `src/pages/admin/CreditNotes.tsx`
- `src/pages/admin/PurchaseOrders.tsx`
- `src/pages/admin/Fulfillment.tsx`
- `src/pages/admin/Payments.tsx`
- `src/pages/admin/Subscriptions.tsx`
- `src/components/admin/OrderFilters.tsx`



## Rapportage-pagina opschonen: Tabs + Stock rapporten

### Probleem 1: Tabs zijn een rommeltje
9 tabs in `grid-cols-5 lg:grid-cols-9` — op 1013px viewport past dat niet, tekst wordt afgesneden, het ziet er niet professioneel uit. Een boekhouder verwacht een strakke, overzichtelijke interface.

### Oplossing: Scrollbare tab-balk
De `TabsList` vervangen door een horizontaal scrollbare balk (geen grid). Met `overflow-x-auto` en `flex-shrink-0` op de triggers. Zo scrollen de tabs netjes zonder afkapping. Optioneel: groepeer gerelateerde tabs visueel (bijv. Financieel/Boekhouding samen, Producten/Voorraad samen).

Alternatief: De 9 tabs terugbrengen naar 6 door slim te combineren:
- **Financieel** + **Boekhouding** → samen (boekhouding als subsectie)
- **Producten** → hernoem naar **Producten & Voorraad** (stock rapporten erbij)
- **Abonnementen** samenvoegen met **Facturen**

Maar gezien de hoeveelheid content per tab: beter scrollbaar houden met alle 9 (+ eventueel een 10e "Voorraad" tab).

### Probleem 2: Geen echte stock/voorraad rapporten
Er zijn nu slechts 3 rapporten in "Producten": catalogus, lage voorraad, voorraadwaardering. Voor een boekhouder die inventaris moet controleren is dat te weinig.

De database heeft: `products.stock`, `products.track_inventory`, `products.low_stock_threshold`, `products.cost_price`, plus `order_items` (verkoop) en `purchase_order_items` (inkoop). Daarmee kunnen we stockmutaties reconstrueren.

### Nieuwe stock-rapporten (tab "Voorraad" of onder "Producten")

1. **Voorraadmutaties** — Reconstructie van in/uit bewegingen per product: verkopen (order_items), inkopen (purchase_order_items), handmatige aanpassingen. Kolommen: Datum, Product, SKU, Type (Verkoop/Inkoop/Correctie), Hoeveelheid (+/-), Referentie (ordernr/PO-nr).

2. **Dode Voorraad (Dead Stock)** — Producten die al >90 dagen niet verkocht zijn maar nog voorraad hebben. Kolommen: Product, SKU, Voorraad, Kostprijs, Waarde, Laatste verkoopdatum, Dagen sinds laatste verkoop.

3. **Voorraadoverzicht met Omloopsnelheid** — Per product: voorraad, verkopen afgelopen periode, omloopsnelheid (verkopen/voorraad), dagen voorraad resterend. Dit vertelt de boekhouder welke producten te veel of te weinig op stock liggen.

4. **Inkoopadvies** — Producten waar de voorraad < verwachte verkopen komende 30 dagen (gebaseerd op historische verkopen). Kolommen: Product, Huidige voorraad, Gem. verkoop/maand, Verwachte voorraad over 30d, Advies hoeveelheid.

### Technische aanpak

**`src/pages/admin/Reports.tsx`**:
- `TabsList`: verander van `grid grid-cols-5 lg:grid-cols-9` naar `flex overflow-x-auto` met `w-auto` triggers
- Voeg een "Voorraad" tab toe (of combineer met Producten als subsectie)
- 4 nieuwe `ReportCard` componenten in de voorraad-sectie

**`src/hooks/useAccountingExports.ts`** (of nieuw bestand `useStockExports.ts`):
- `useStockMovementExport` — query order_items + purchase_order_items, combineer als mutatielijst
- `useDeadStockExport` — products met stock > 0 LEFT JOIN order_items, filter op laatste verkoop > 90 dagen
- `useStockTurnoverExport` — products + count order_items per product in periode
- `useReorderAdviceExport` — products met gem. verkoop/maand vs huidige voorraad

### Bestanden
- `src/pages/admin/Reports.tsx` — tab-styling + nieuwe voorraad-sectie
- `src/hooks/useStockExports.ts` — nieuw bestand met 4 stock export hooks


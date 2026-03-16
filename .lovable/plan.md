

## POS Systeem: Grondige Screening & Verbeterplan

Na analyse van alle POS-bestanden (~1500 regels POSTerminal.tsx, 18 dialoog-componenten, hooks, en instellingen) zijn dit de bevindingen:

---

### Wat er GOED werkt
- Barcode scanner is al geïntegreerd (`useBarcodeScanner` hook + `findProductByBarcode`)
- Bon printer werkt via Web Print API (`usePOSPrinter` met iframe-methode)
- Kaslade-commando aanwezig (ESC/POS pulse)
- Offline modus met IndexedDB sync
- Multi-payment (cadeaukaart, loyalty, contant, pin)
- Sessie-management (dag openen/sluiten, kassarapport)

---

### PROBLEMEN GEVONDEN

**1. Layout: Lange productnamen breken de UI** (jouw screenshot)
- QuickButtonDialog product-items hebben `truncate` maar het zoekresultaat toont de volledige naam waardoor lange titels (bijv. "VanXcel TheSMALL Kit – Portable Power Setup | 500W Powerstation + Solar Panel") ver buiten het venster uitlopen
- Prijzen worden weggedrukt of overlappen

**2. Geen categorie/subcategorie navigatie in het productpaneel**
- Het linkerpaneel (regel 920-925) heeft alleen "Quick Buttons" en een zoekbalk — géén categorie-tabbladen of productgrid
- Bij honderden producten is het onmogelijk om snel te navigeren
- Er staat letterlijk `{/* Placeholder for product grid/categories */}` op regel 924

**3. Producten missen barcode generatie/download**
- Het `Product` type heeft een `barcode` veld, maar:
  - Er is geen UI om barcodes te genereren vanuit EAN/SKU
  - Er is geen download/print functionaliteit voor barcodelabels
  - Het `bol_ean` veld bestaat apart maar wordt niet gebruikt voor POS barcodes

**4. Scanner instructies ontbreken**
- De barcode scanner hook WERKT al — elke USB/Bluetooth scanner die als "keyboard" fungeert werkt out-of-the-box
- Maar er is **nergens uitleg** voor de gebruiker hoe dit te koppelen
- Terminal settings heeft `hasScanner` toggle maar geen helptext

**5. Bon printer configuratie is onduidelijk**
- Settings toont printer toggle maar legt niet uit welke printers ondersteund worden
- Geen testprint functionaliteit
- Kaslade-opening werkt via workaround (ESC/POS in print frame) — fragiel

**6. POSTerminal.tsx is 1488 regels — monoliet**
- 20+ useState declaraties, 10+ handler functies, 15+ dialogen inline
- Onhoudbaar voor toekomstige wijzigingen

**7. Hardcoded BTW 21%**
- `const taxRate = 21;` op regel 209 — negeert het `vat_rate_id` van producten
- Negeert de `defaultTaxRate` uit terminal settings

---

### IMPLEMENTATIEPLAN

#### Stap 1: Fix zoekresultaat layout (QuickButtonDialog + POS search)
- Beperk container-breedte, forceer `truncate` + `max-w-[calc]` op productnamen
- Prijzen altijd rechts met `shrink-0 whitespace-nowrap`
- Maak QuickButtonDialog breder (`max-w-3xl`) voor lange namen

#### Stap 2: Categorie-navigatie in POS productpaneel
- Haal categorieën op via bestaande `useCategories()` hook
- Bouw een horizontale categorie-balk (tabs/chips) boven het productpaneel
- Bij klik: toon alle producten in die categorie als een grid (afbeelding + naam + prijs)
- Subcategorieën tonen als ze bestaan (breadcrumb-stijl navigatie)
- "Alle producten" als standaard tab
- Zoekfunctie blijft bovenaan werken

#### Stap 3: Barcode generatie & download bij producten
- Nieuwe component `ProductBarcodeDialog.tsx` in admin/products
- Genereer barcode-afbeelding vanuit `product.barcode` of `product.sku` met een JS barcode library (JsBarcode)
- Download als PNG/PDF, of bulk-print barcodelabels
- QR-code optie (product-URL voor klant-scanning)
- Knop toevoegen op productdetail/lijst pagina

#### Stap 4: Scanner & Printer help/setup in terminal settings
- Uitbreidbare help-sectie in `POSTerminalSettings.tsx`:
  - **Scanner**: "Sluit een USB of Bluetooth barcodescanner aan. Deze werkt automatisch als toetsenbordinvoer."
  - **Printer**: "Gebruik een ESC/POS-compatibele thermische printer (bijv. Epson TM-T20, Star TSP143). Stel deze in als standaardprinter in je besturingssysteem."
- Voeg een "Testprint" knop toe die een voorbeeldbon afdrukt
- Voeg een "Kaslade testen" knop toe

#### Stap 5: BTW per product i.p.v. hardcoded
- In `addToCart`: haal `vat_rate` op van het product (via joined data of lookup)
- In `cartTotals`: bereken BTW per item-regel i.p.v. flat 21%
- Fallback naar terminal `defaultTaxRate` als product geen vat_rate heeft

#### Stap 6: Refactor POSTerminal.tsx (splitsen)
- Extract naar aparte bestanden:
  - `POSProductPanel.tsx` — zoek, categorieën, productgrid, snelknoppen
  - `POSCartPanel.tsx` — winkelwagen, totalen, actieknoppen
  - `POSHeader.tsx` — header met status, reader, knoppen
  - `usePOSCart.ts` — cart state, addToCart, updateQuantity, etc.
- POSTerminal.tsx wordt een thin orchestrator (~200 regels)

---

### Technische details

**Barcode library**: `JsBarcode` (npm package) — genereert EAN-13, CODE128, etc. als SVG/Canvas. Geen backend nodig.

**Categorie-navigatie dataflow**:
```text
useCategories() → top-level categories as chips
  ↓ click
filter products by category_id → show as grid
  ↓ subcategory exists?
show subcategory chips → deeper filter
```

**Product grid in POS**: 4-6 kolommen, card met afbeelding (64x64), naam (truncated), prijs. Click = addToCart.

**BTW fix**: Haal `vat_rates` tabel op via bestaande hook of join. Per cart item: `item.tax_rate = product.vat_rate?.rate || terminalDefaultRate || 21`.

Dit plan pakt alle 7 genoemde problemen aan en transformeert het POS van een prototype naar een productie-waardig kassasysteem.


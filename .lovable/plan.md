

# Bulk Acties Uitbreiden - Orders & Fulfillment

## Huidige Problemen

### Orders pagina
De bulk action bar toont alleen:
- **Print Labels** - opent een `BatchPrintDialog` die labels zoekt in `shipping_labels` tabel (werkt alleen als er labels aangemaakt zijn)
- **Deselecteer** knop

Er ontbreken essientiele bulk acties.

### Fulfillment pagina
De bulk action bar toont twee **disabled** knoppen die niets doen:
- "Pakbonnen printen" (disabled)
- "Batch labels" (disabled)

Compleet niet-functioneel.

## Oplossing

Beide pagina's krijgen een uitgebreide, werkende bulk action bar met een gedeeld dropdown-menu patroon (vergelijkbaar met `TenantBulkActions`).

---

### Nieuwe Bulk Acties - Orders pagina

| Actie | Wat het doet |
|-------|-------------|
| **Bulk status wijzigen** | Dropdown met statusopties (In behandeling, Verzonden, Afgeleverd, Geannuleerd) - past alle geselecteerde orders aan |
| **Bulk betaalstatus wijzigen** | Markeer geselecteerd als betaald/onbetaald |
| **Pakbonnen downloaden** | Genereert pakbon-PDFs voor alle geselecteerde orders en merged ze tot 1 PDF download (hergebruikt `generatePackingSlipPdf` + `mergePdfs` patroon) |
| **Labels printen** | Bestaande `BatchPrintDialog` (blijft) |
| **Exporteren naar CSV** | Exporteert geselecteerde orders als CSV bestand |
| **Bulk verwijderen** | Met bevestigingsdialoog |

### Nieuwe Bulk Acties - Fulfillment pagina

| Actie | Wat het doet |
|-------|-------------|
| **Pakbonnen downloaden** | Zelfde merged PDF aanpak als bij orders |
| **Labels printen** | Opent `BatchPrintDialog` met geselecteerde order IDs |
| **Markeer als verzonden** | Bulk status update naar "shipped" |
| **Markeer als afgeleverd** | Bulk status update naar "delivered" |
| **Exporteren** | CSV export van geselecteerde fulfillment orders |

---

## Technische Aanpak

### Nieuw bestand: `src/components/admin/OrderBulkActions.tsx`

Een zelfstandig component (vergelijkbaar met `TenantBulkActions`) dat:
- Een dropdown-menu rendert met alle beschikbare acties
- Bevat dialogen voor statuswijziging en verwijdering
- `generatePackingSlipPdf` hergebruikt voor batch pakbon generatie
- `mergePdfs`/`downloadMergedPdf` hergebruikt om alle pakbonnen samen te voegen tot 1 PDF
- CSV export functionaliteit bevat
- Props: `selectedOrderIds`, `orders` (voor data), `onComplete`, `onClearSelection`

### Nieuw bestand: `src/components/admin/FulfillmentBulkActions.tsx`

Vergelijkbaar component voor de fulfillment pagina:
- Bulk status updates (verzonden/afgeleverd) via `supabase.from('orders').update()`
- Pakbon generatie en download
- `BatchPrintDialog` integratie voor labels
- CSV export

### Wijziging: `src/pages/admin/Orders.tsx`

- Vervang de huidige inline bulk action bar (regels 108-133) door `<OrderBulkActions>`
- Geef de benodigde props door (geselecteerde IDs, orders data, callbacks)

### Wijziging: `src/pages/admin/Fulfillment.tsx`

- Vervang de huidige disabled knoppen (regels 320-339) door `<FulfillmentBulkActions>`
- Geef geselecteerde orders en callbacks door

### Batch Pakbon Generatie Logica

Voor de pakbon-download worden de volgende stappen uitgevoerd:
1. Haal orderdetails + items op voor alle geselecteerde orders
2. Haal tenant gegevens op (naam, adres, etc.)
3. Genereer per order een pakbon PDF via `generatePackingSlipPdf`
4. Merge alle PDFs via `pdf-lib` (`PDFDocument.create()` + `copyPages`)
5. Download als 1 bestand: `pakbonnen-YYYY-MM-DD.pdf`

### CSV Export Format

Kolommen: Bestelnummer, Klant, Email, Status, Betaalstatus, Totaal, Datum, Tracking, Carrier

---

## Bestanden

| Bestand | Actie |
|---------|-------|
| `src/components/admin/OrderBulkActions.tsx` | Nieuw |
| `src/components/admin/FulfillmentBulkActions.tsx` | Nieuw |
| `src/pages/admin/Orders.tsx` | Wijzigen - inline bar vervangen |
| `src/pages/admin/Fulfillment.tsx` | Wijzigen - disabled knoppen vervangen |


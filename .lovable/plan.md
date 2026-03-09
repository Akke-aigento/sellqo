

## Pakbon fixes: dynamische vakhoogte + document logo

### Probleem 1: Vakken te klein
De info-vakken ("Bestelling" en "Verzendadres") hebben een vaste hoogte van **70px**. Bij adressen met 4+ regels (naam + straat + postcode/stad + landcode) valt de landcode erbuiten.

**Fix**: Bereken de hoogte dynamisch op basis van het aantal regels in beide vakken. Neem het maximum van links en rechts zodat ze even hoog zijn.

### Probleem 2: Document logo wordt niet gebruikt
Het veld `document_logo_url` wordt al doorgegeven aan de PDF generator en de code geeft al voorrang aan `document_logo_url` boven `logo_url`. Als het logo is geüpload maar niet verschijnt, kan het zijn dat de `(currentTenant as any)` cast het veld niet vindt doordat het type nog niet gesynct is. We moeten verifiëren dat de kolom correct in de database staat en dat de upload daadwerkelijk is opgeslagen.

### Wijzigingen

**`src/utils/packingSlipPdf.ts`** (regel 170-201):
- Vervang de vaste `boxHeight = 70` door een dynamische berekening:
  - Links: 3 regels (header + nummer + datum + klant) = 4 items
  - Rechts: header + naam + adresregels (variabel, 1-4 regels)
  - `boxHeight = Math.max(leftLines, rightLines) * 13 + 30` (padding)
- Teken de rechthoeken pas nadat het aantal regels bekend is

**Geen andere bestanden nodig** — de logo-doorgifte en upload werken al correct. We controleren alleen of het opgeslagen `document_logo_url` correct wordt opgehaald.


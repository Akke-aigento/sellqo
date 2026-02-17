

# EPC QR-code toevoegen aan factuur-PDF

## Probleem

De factuur-PDF bevat een sectie "Betalingsgegevens" met de tekst "Scan de QR-code met uw banking app om te betalen", maar er wordt **geen daadwerkelijke QR-code** gegenereerd en ingebed. Dit was een placeholder (regel 1009: `// EPC QR code generation would require external library in production`).

Voor offertes wordt er momenteel geen PDF gegenereerd -- de offerte wordt als HTML-e-mail verstuurd. Een QR-code op offertes is minder relevant omdat er op dat moment nog geen betaling verwacht wordt.

## Oplossing

Een EPC-conforme QR-code genereren in de `generate-invoice` Edge Function en als afbeelding inbedden in de factuur-PDF.

## Technische aanpak

### `supabase/functions/generate-invoice/index.ts`

**Stap 1** - QR-code library importeren:
```
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";
```
Deze Deno-library genereert een base64-encoded GIF-afbeelding, volledig dependency-free.

**Stap 2** - EPC-string opbouwen (dezelfde logica als in `src/lib/epcQrCode.ts`):
```
// EPC QR data bouwen
const epcLines = [
  'BCD', '002', '1', 'SCT',
  tenant.bic || '',
  tenant.name.slice(0, 70),
  tenant.iban.replace(/\s/g, '').toUpperCase(),
  `EUR${total.toFixed(2)}`,
  '',
  ogmReference.replace(/[^\d]/g, ''),  // Alleen cijfers
  '',
  ''
];
const epcString = epcLines.join('\n');
```

**Stap 3** - QR-code genereren en als afbeelding in de PDF plaatsen:
```
const qrDataUrl = await qrcode(epcString);
// qrDataUrl = "data:image/gif;base64,..."

// Base64 decoderen en als GIF embedden in pdf-lib
const base64Data = qrDataUrl.split(',')[1];
const qrImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

// pdf-lib ondersteunt geen GIF, maar we kunnen het converteren
// Alternatief: gebruik een PNG QR-library of teken de QR handmatig
```

**Opmerking**: `pdf-lib` ondersteunt alleen PNG en JPG. De Deno qrcode library levert GIF. De oplossing is om de QR-code **pixel-voor-pixel te tekenen** met `page.drawRectangle()` via een pure QR-code encoder, of een library te gebruiken die direct PNG output geeft. De meest robuuste aanpak is een QR-encoder die een matrix teruggeeft, en dan elk zwart blokje als rectangle tekenen in de PDF.

**Stap 4** - De bestaande placeholder-tekst vervangen door de werkelijke QR-code naast de betalingsgegevens, rechts uitgelijnd in de "Betalingsgegevens" sectie.

### Visueel resultaat op de factuur

```text
+----------------------------------------------+
| Betalingsgegevens              [QR CODE]     |
| IBAN: BE00 0000 0000 0000                    |
| BIC:  GEBABEBB                               |
| Mededeling: +++123/4567/89012+++             |
|                                              |
| Scan de QR-code met uw banking app           |
+----------------------------------------------+
```

### Offertes

Offertes worden momenteel als HTML-e-mail verstuurd (geen PDF). Een betaal-QR-code is hier niet van toepassing omdat er nog geen betaling verwacht wordt. Dit kan in een toekomstige stap als PDF-bijlage met QR-code worden toegevoegd als gewenst.



# Directe Labelprinter Integratie voor Sellqo

## Overzicht

Dit plan implementeert twee belangrijke functionaliteiten:
1. **Directe labelprinter koppeling** via WebUSB API - print labels zonder browser dialoog
2. **Labels ophalen van bestaande Sendcloud/MyParcel orders** - voor orders die al via die platforms zijn aangemaakt

## Huidige Situatie

De app gebruikt momenteel:
- `window.open(label_url, '_blank')` om labels te openen in een nieuw tabblad
- `usePOSPrinter` hook met Web Print API voor kassabonnen (browser print dialoog)
- Edge Functions voor label creatie (Sendcloud, MyParcel, Bol VVB)
- Labels worden opgeslagen in `shipping_labels` tabel met `label_url`

## Deel 1: Directe Labelprinter Integratie

### Technische Aanpak

**WebUSB API** is de beste optie voor directe USB communicatie:
- Werkt in Chrome/Edge (85%+ van zakelijke gebruikers)
- Geen extra software nodig
- Directe communicatie met printer
- Ondersteunt Zebra ZPL, Dymo, Brother, TSC

### Nieuwe Bestanden

#### 1. `src/hooks/useLabelPrinter.ts`
```typescript
// WebUSB communicatie met labelprinters
// Ondersteunde printers:
// - Zebra (ZPL commands)
// - Dymo (LabelWriter)  
// - Brother (QL series)
// - TSC (TSPL)

interface LabelPrinter {
  id: string;
  name: string;
  vendorId: number;
  productId: number;
  protocol: 'zpl' | 'epl' | 'raw' | 'tspl';
}

// Functies:
// - detectPrinters(): Promise<LabelPrinter[]>
// - connectPrinter(printer: LabelPrinter): Promise<boolean>
// - printLabel(pdfUrl: string, options?: PrintOptions): Promise<boolean>
// - printLabelDirect(data: Uint8Array): Promise<boolean>
// - isSupported: boolean (browser check)
```

#### 2. `src/components/admin/settings/LabelPrinterSettings.tsx`
```
┌─────────────────────────────────────────────────────────────────┐
│  Labelprinter Instellingen                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🖨️ Gekoppelde Printer                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Zebra GK420d                              [Ontkoppelen]  │  │
│  │  Status: Verbonden ✓                                      │  │
│  │  Laatste print: 2 minuten geleden                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Labelformaat                                                   │
│  ○ A6 (105 × 148 mm) - Standaard verzendlabel                  │
│  ○ 4x6 inch (102 × 152 mm) - US standaard                      │
│  ○ Brother 62mm breed                                           │
│                                                                 │
│  Print methode                                                  │
│  ● Direct printen (WebUSB) - Aanbevolen                        │
│  ○ Browser print dialoog - Fallback                             │
│                                                                 │
│  [Detecteer Printers]  [Test Print]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Wijzigingen aan Bestaande Bestanden

#### 3. `src/components/admin/BolActionsCard.tsx`
Toevoegen van "Direct Printen" knop naast "Download Label":

```tsx
// Nieuwe imports
import { useLabelPrinter } from '@/hooks/useLabelPrinter';

// In component
const { printLabel, isConnected, isSupported } = useLabelPrinter();

// Nieuwe knop
{latestLabel.label_url && (
  <div className="flex gap-2">
    {isConnected && (
      <Button
        variant="default"
        size="sm"
        className="flex-1"
        onClick={() => printLabel(latestLabel.label_url!)}
      >
        <Printer className="h-4 w-4 mr-2" />
        Print Label
      </Button>
    )}
    <Button
      variant="outline"
      size="sm"
      className={isConnected ? '' : 'w-full'}
      onClick={() => window.open(latestLabel.label_url!, '_blank')}
    >
      <Download className="h-4 w-4 mr-2" />
      Download
    </Button>
  </div>
)}
```

#### 4. Database uitbreiding
Toevoegen aan `shipping_integrations.settings`:
```json
{
  "labelPrinter": {
    "enabled": true,
    "vendorId": 2655,
    "productId": 14,
    "protocol": "zpl",
    "labelFormat": "a6"
  }
}
```

## Deel 2: Labels Ophalen van Sendcloud/MyParcel

### Probleem
Sommige orders worden buiten Sellqo om aangemaakt in Sendcloud/MyParcel. We willen deze labels kunnen ophalen en koppelen.

### Oplossing

#### 1. Nieuwe Edge Function: `fetch-external-label`

```typescript
// supabase/functions/fetch-external-label/index.ts
// 
// Haalt bestaande labels op van Sendcloud of MyParcel
// op basis van ordernummer of trackingnummer

// Sendcloud API:
// GET /parcels?order_number={orderNumber}
// Response bevat label.normal_printer URL

// MyParcel API:  
// GET /shipments?reference_identifier={orderNumber}
// Response bevat barcode, moet daarna PDF ophalen via
// GET /shipments/{id}/download_labels

// Flow:
// 1. Zoek parcel/shipment op ordernummer
// 2. Download PDF label
// 3. Sla op in Supabase Storage (met A6 cropping optie)
// 4. Maak shipping_labels record aan
```

#### 2. UI Component: `FetchExternalLabelDialog.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Label ophalen van externe provider                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Provider                                                       │
│  [Sendcloud ▼]                                                  │
│                                                                 │
│  Zoeken op                                                      │
│  ○ Ordernummer: #0042                                           │
│  ○ Trackingnummer: ___________________________                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ⚠️ Let op: Dit haalt een bestaand label op dat al is     │  │
│  │  aangemaakt in Sendcloud. Het label wordt niet opnieuw    │  │
│  │  gegenereerd.                                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                               [Annuleren]  [Label Ophalen]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Integratie in OrderDetail

De `BolActionsCard` wordt uitgebreid of er komt een generieke `ShippingActionsCard` die werkt voor alle orders:

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 Verzending                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Geen label gekoppeld                                           │
│                                                                 │
│  [+ Nieuw Label Aanmaken]                                       │
│  [↓ Bestaand Label Ophalen] ← Nieuw!                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementatie Overzicht

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| `src/hooks/useLabelPrinter.ts` | Nieuw | WebUSB hook voor directe printercommunicatie |
| `src/components/admin/settings/LabelPrinterSettings.tsx` | Nieuw | Printer configuratie UI |
| `supabase/functions/fetch-external-label/index.ts` | Nieuw | Ophalen labels van Sendcloud/MyParcel |
| `src/components/admin/FetchExternalLabelDialog.tsx` | Nieuw | Dialog voor label ophalen |
| `src/components/admin/BolActionsCard.tsx` | Update | Print knop + fetch optie |
| `src/components/admin/ShippingActionsCard.tsx` | Nieuw | Generieke verzendacties voor alle orders |
| `src/pages/admin/Shipping.tsx` | Update | Link naar printer settings |
| `src/types/shippingIntegration.ts` | Update | Printer configuratie types |

## Browser Compatibiliteit

```
┌────────────────────────────────────────────────────────────────┐
│  WebUSB Ondersteuning                                          │
├────────────────────────────────────────────────────────────────┤
│  ✓ Chrome 61+        │  ✓ Edge 79+        │  ✗ Safari          │
│  ✓ Chrome Android    │  ✗ Firefox         │  ✓ Opera 48+       │
└────────────────────────────────────────────────────────────────┘

Fallback: Als WebUSB niet beschikbaar is, toont de app 
automatisch de "Download" optie met browser print dialoog.
```

## Technische Details

### WebUSB Printer Protocol

```typescript
// Zebra ZPL voorbeeld voor A6 label
const ZPL_TEMPLATE = `
^XA
^FO50,50^A0N,40,40^FD${shipmentInfo.name}^FS
^FO50,100^A0N,30,30^FD${shipmentInfo.address}^FS
^FO50,140^A0N,30,30^FD${shipmentInfo.postalCode} ${shipmentInfo.city}^FS
^BY3,2,100
^FO50,200^BC^FD${trackingNumber}^FS
^XZ
`;

// Of direct PDF bytes sturen naar printer
async function printPdfToZebra(pdfBytes: Uint8Array) {
  const device = await navigator.usb.requestDevice({
    filters: [{ vendorId: 0x0A5F }] // Zebra
  });
  await device.open();
  await device.selectConfiguration(1);
  await device.claimInterface(0);
  await device.transferOut(1, pdfBytes);
  await device.close();
}
```

### Sendcloud Label Fetch API

```typescript
// GET https://panel.sendcloud.sc/api/v2/parcels?order_number=0042
// Response:
{
  "parcels": [{
    "id": 123456,
    "tracking_number": "3STEST123456",
    "label": {
      "label_printer": "https://panel.sendcloud.sc/api/v2/labels/label_printer/123456"
    }
  }]
}
```

### MyParcel Label Fetch API

```typescript
// GET https://api.myparcel.nl/shipments?reference_identifier=0042
// Response bevat shipment ID

// GET https://api.myparcel.nl/shipment_labels/{id}
// Response: PDF binary
```

## Resultaat

- **Direct printen vanuit Sellqo** - Geen browser dialoog, 1-click printing
- **Bestaande labels ophalen** - Sync met Sendcloud/MyParcel orders die extern zijn aangemaakt  
- **Fallback mechanisme** - Altijd werkend, zelfs zonder WebUSB support
- **Configureerbaar** - Printer type, labelformaat, print methode instelbaar
- **A6 cropping** - Automatisch bijsnijden ook voor opgehaalde labels

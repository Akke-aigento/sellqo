
# Implementatieplan: Bol.com Auto-Acceptatie, Amazon Buy Shipping & Batch Label Printing

## Overzicht

Dit plan implementeert drie belangrijke functionaliteiten:
1. **Auto-acceptatie toggle voor Bol.com orders** - Orders automatisch accepteren via Bol.com API
2. **Amazon Buy Shipping integratie** - Labels genereren via Amazon's verzend-API
3. **Batch label printing** - Meerdere labels tegelijk printen

---

## Deel 1: Auto-Acceptatie Toggle voor Bol.com

### Huidige Situatie

| Functie | Status |
|---------|--------|
| `autoConfirmShipment` - Verzendbevestiging met T&T | ✅ Geïmplementeerd |
| `autoAcceptOrder` - Order accepteren bij import | ❌ Ontbreekt |

De `sync-bol-orders` functie importeert orders, maar roept de Bol.com Accept Order API niet aan.

### Implementatie

#### 1.1 Type Uitbreiding
**Bestand:** `src/types/marketplace.ts`

Toevoegen aan `MarketplaceSettings`:
```typescript
autoAcceptOrder?: boolean;  // Automatisch orders accepteren bij import
```

#### 1.2 UI Component Update
**Bestand:** `src/components/admin/marketplace/BolVVBSettings.tsx`

Nieuwe sectie toevoegen voor order acceptatie:

```text
┌─────────────────────────────────────────────────────────────────┐
│  📦 Order Verwerking                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Automatische order acceptatie                     [Toggle]     │
│  Orders worden automatisch geaccepteerd bij                     │
│  import vanuit Bol.com                                          │
│                                                                 │
│  ⚠️ Let op: Geaccepteerde orders kunnen niet meer             │
│  worden geweigerd via Bol.com                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.3 Edge Function: Accept Order API
**Bestand:** `supabase/functions/accept-bol-order/index.ts` (Nieuw)

```typescript
// Bol.com Accept Order API
// PUT /retailer/orders/{order-id}/accept
//
// Request body:
// {
//   "orderItems": [{
//     "orderItemId": "123",
//     "quantity": 1
//   }]
// }
//
// Response: Process status URL voor tracking
```

#### 1.4 Sync Function Update
**Bestand:** `supabase/functions/sync-bol-orders/index.ts`

Na succesvol importeren van een order, checken op `autoAcceptOrder` setting:

```typescript
// Na order insert (regel ~334)
if (settings.autoAcceptOrder) {
  await fetch(`${supabaseUrl}/functions/v1/accept-bol-order`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      order_id: newOrder.id,
      connection_id: connection.id
    })
  });
}
```

---

## Deel 2: Amazon Buy Shipping Integratie

### Wat is Amazon Buy Shipping?

Amazon Buy Shipping is vergelijkbaar met Bol.com VVB:
- Labels genereren via Amazon's API
- Goedkopere tarieven via Amazon's contracten
- Automatische tracking updates
- Werkt alleen voor MFN (Merchant Fulfilled) orders

### API Endpoints

| Endpoint | Beschrijving |
|----------|--------------|
| `GET /mfn/v0/eligibleShippingServices` | Beschikbare verzendopties ophalen |
| `POST /mfn/v0/shipments` | Verzending aanmaken + label genereren |
| `GET /mfn/v0/shipments/{shipmentId}` | Verzending status ophalen |

### Implementatie

#### 2.1 Nieuwe Edge Function
**Bestand:** `supabase/functions/create-amazon-buy-shipping-label/index.ts`

Functionaliteit:
1. Order ophalen uit database
2. Marketplace connection credentials ophalen
3. Eligible shipping services ophalen van Amazon
4. Goedkoopste/snelste optie selecteren
5. Shipment aanmaken + label genereren
6. Label opslaan in Supabase Storage
7. `shipping_labels` record aanmaken
8. Order status updaten

```text
Flow:
┌──────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Order   │────▶│ Get Eligible      │────▶│ Create Shipment  │
│  Detail  │     │ Services          │     │ + Get Label      │
└──────────┘     └───────────────────┘     └──────────────────┘
                                                   │
                                                   ▼
                 ┌───────────────────┐     ┌──────────────────┐
                 │ shipping_labels   │◀────│ Store in         │
                 │ record            │     │ Supabase Storage │
                 └───────────────────┘     └──────────────────┘
```

#### 2.2 Type Uitbreidingen
**Bestand:** `src/types/marketplace.ts`

```typescript
// Amazon-specifieke settings toevoegen
amazonBuyShippingEnabled?: boolean;
amazonDefaultShippingService?: string;
amazonAutoSelectCheapest?: boolean;
```

#### 2.3 UI Component
**Bestand:** `src/components/admin/marketplace/AmazonBuyShippingSettings.tsx` (Nieuw)

```text
┌─────────────────────────────────────────────────────────────────┐
│  📦 Amazon Buy Shipping                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Amazon Buy Shipping inschakelen               [Toggle]         │
│  Genereer labels via Amazon voor lagere tarieven                │
│                                                                 │
│  Selectie strategie                                             │
│  ○ Goedkoopste optie (aanbevolen)                              │
│  ○ Snelste optie                                                │
│  ○ Handmatige selectie                                          │
│                                                                 │
│  ℹ️ Amazon Buy Shipping werkt alleen voor MFN orders           │
│  (zelf verzenden). FBA orders worden door Amazon afgehandeld.  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4 Order Detail Integratie
**Bestand:** `src/components/admin/AmazonActionsCard.tsx` (Nieuw)

Vergelijkbaar met `BolActionsCard.tsx`:
- Toon Amazon order info
- "Amazon Label Aanmaken" knop
- Label status en print opties
- Tracking info weergave

---

## Deel 3: Batch Label Printing

### Functionaliteit

Meerdere orders selecteren en alle labels in één keer printen of downloaden.

### Implementatie

#### 3.1 Order Selectie UI
**Bestand:** `src/pages/admin/Orders.tsx`

Toevoegen van:
- Checkbox voor elke order regel
- "Selecteer alle" optie
- Bulk actie toolbar wanneer orders geselecteerd zijn

```text
┌─────────────────────────────────────────────────────────────────┐
│  ☑ 3 orders geselecteerd                                       │
│  [🖨️ Print Labels]  [📥 Download Labels]  [❌ Deselecteer]      │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Batch Print Hook
**Bestand:** `src/hooks/useBatchLabelPrint.ts` (Nieuw)

```typescript
interface BatchPrintOptions {
  orderIds: string[];
  printMethod: 'webusb' | 'browser' | 'download';
  onProgress?: (current: number, total: number) => void;
}

function useBatchLabelPrint() {
  // Ophalen van alle labels voor geselecteerde orders
  // Sequentieel printen via useLabelPrinter
  // Of merge naar één PDF voor download
}
```

#### 3.3 Batch Print Dialog
**Bestand:** `src/components/admin/BatchPrintDialog.tsx` (Nieuw)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Labels Printen (5 orders)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ #0042 - VVB label (PostNL)                                  │
│  ✓ #0043 - Sendcloud label (DHL)                               │
│  ✗ #0044 - Geen label beschikbaar                              │
│  ✓ #0045 - VVB label (PostNL)                                  │
│  ✓ #0046 - Amazon Buy Shipping (Amazon Logistics)              │
│                                                                 │
│  Totaal: 4 labels beschikbaar                                   │
│                                                                 │
│  Print methode                                                  │
│  ● Direct printen (Zebra GK420d)                               │
│  ○ Browser print dialoog                                        │
│  ○ Download als PDF                                             │
│                                                                 │
│  Progress: [████████████░░░░░░░░] 3/4                           │
│                                                                 │
│                               [Annuleren]  [Start Printen]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.4 PDF Merge Functie (voor download)
**Bestand:** `src/utils/pdfMerge.ts` (Nieuw)

Voor de "Download als PDF" optie worden alle labels samengevoegd tot één PDF met pdf-lib.

---

## Implementatie Overzicht

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| **Bol.com Auto-Accept** | | |
| `src/types/marketplace.ts` | Update | `autoAcceptOrder` setting |
| `src/components/admin/marketplace/BolVVBSettings.tsx` | Update | Toggle UI |
| `supabase/functions/accept-bol-order/index.ts` | Nieuw | Accept API call |
| `supabase/functions/sync-bol-orders/index.ts` | Update | Auto-accept na import |
| **Amazon Buy Shipping** | | |
| `src/types/marketplace.ts` | Update | Amazon shipping settings |
| `supabase/functions/create-amazon-buy-shipping-label/index.ts` | Nieuw | Label generatie |
| `src/components/admin/marketplace/AmazonBuyShippingSettings.tsx` | Nieuw | Settings UI |
| `src/components/admin/AmazonActionsCard.tsx` | Nieuw | Order detail acties |
| **Batch Printing** | | |
| `src/hooks/useBatchLabelPrint.ts` | Nieuw | Batch print logica |
| `src/components/admin/BatchPrintDialog.tsx` | Nieuw | Batch print UI |
| `src/utils/pdfMerge.ts` | Nieuw | PDF samenvoegen |
| `src/pages/admin/Orders.tsx` | Update | Order selectie + toolbar |

---

## Technische Details

### Bol.com Accept Order API

```typescript
// PUT https://api.bol.com/retailer/orders/{orderId}/accept
// Headers: Authorization: Bearer {token}

interface AcceptOrderRequest {
  orderItems: Array<{
    orderItemId: string;
    quantity: number;
  }>;
}

// Response: 202 Accepted
interface AcceptOrderResponse {
  processStatusId: string;
  entityId: string;
  eventType: string;
  description: string;
  status: string;
  createTimestamp: string;
  links: Array<{
    rel: string;
    href: string;
    method: string;
  }>;
}
```

### Amazon Buy Shipping API

```typescript
// POST https://sellingpartnerapi-eu.amazon.com/mfn/v0/shipments

interface CreateShipmentRequest {
  shipmentRequestDetails: {
    amazonOrderId: string;
    sellerOrderId?: string;
    itemList: Array<{
      orderItemId: string;
      quantity: number;
    }>;
    shipFromAddress: {
      name: string;
      addressLine1: string;
      city: string;
      postalCode: string;
      countryCode: string;
    };
    packageDimensions: {
      length: number;
      width: number;
      height: number;
      unit: 'centimeters' | 'inches';
    };
    weight: {
      value: number;
      unit: 'kg' | 'oz';
    };
    shippingServiceOptions: {
      deliveryExperience: 'DeliveryConfirmationWithAdultSignature' | 
                          'DeliveryConfirmationWithSignature' |
                          'DeliveryConfirmationWithoutSignature' |
                          'NoTracking';
      carrierWillPickUp: boolean;
    };
  };
  shippingServiceId: string;  // Van eligibleShippingServices
}

// Response bevat:
// - shipmentId
// - amazonOrderId
// - label (base64 encoded PDF)
// - trackingId
```

### Batch Print Sequentie

```text
1. Gebruiker selecteert orders
2. Systeem haalt shipping_labels op voor alle orders
3. Filter: alleen orders met label_url
4. Toon overzicht in dialog
5. Bij "Start Printen":
   a. WebUSB: sequentieel printen met delay (500ms)
   b. Browser: merge PDFs, open in nieuwe tab
   c. Download: merge PDFs, trigger download
6. Toon progress indicator
7. Success/error feedback per label
```

---

## Database Impact

Geen schema wijzigingen nodig - we gebruiken bestaande structuren:
- `shipping_labels` - labels opslaan
- `marketplace_connections.settings` - nieuwe settings opslaan (JSON)
- `orders` - status updates

---

## Config Updates

**Bestand:** `supabase/config.toml`

```toml
[functions.accept-bol-order]
verify_jwt = false

[functions.create-amazon-buy-shipping-label]
verify_jwt = false
```

---

## Resultaat

Na implementatie:

| Feature | Beschrijving |
|---------|--------------|
| **Bol.com Auto-Accept** | Orders worden automatisch geaccepteerd bij import - één stap minder voor de verkoper |
| **Amazon Buy Shipping** | Labels genereren via Amazon voor MFN orders - goedkopere tarieven, automatische tracking |
| **Batch Printing** | Meerdere labels tegelijk printen - tijdsbesparing bij veel orders |

Alle features integreren naadloos met de bestaande `useLabelPrinter` hook en shipping_labels infrastructuur.

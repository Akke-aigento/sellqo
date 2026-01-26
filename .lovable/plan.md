
# Bol.com Volledige Order Automatisering + VVB Labels met Bedrag Threshold

## Overzicht

Dit plan implementeert volledige Bol.com order automatisering inclusief:
1. **VVB (Verzenden via Bol) paklabel generatie** met instelbaar maximumbedrag
2. **Automatische verzendbevestiging** naar Bol.com API met track & trace
3. **Intelligente provider routing**: VVB voor goedkope orders, Sendcloud voor dure/verzekerde orders

## Jouw Use Case Ondersteund ✅

```
Order ≤ €300 → VVB label (goedkoper, geen verzekering)
Order > €300 → Sendcloud label (verzekerd via eigen account)
```

Het drempelbedrag is volledig instelbaar per Bol.com connectie.

---

## Architectuur

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    LABEL GENERATIE BESLISBOOM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Order van Bol.com?                                                 │
│       │                                                             │
│       ├── NEE → Gebruik standaard Sendcloud/MyParcel               │
│       │                                                             │
│       └── JA → Check VVB instellingen                              │
│               │                                                     │
│               ├── VVB uitgeschakeld → Sendcloud                    │
│               │                                                     │
│               └── VVB ingeschakeld                                 │
│                       │                                             │
│                       ├── Order ≤ vvb_max_amount → VVB Label       │
│                       │                                             │
│                       └── Order > vvb_max_amount → Sendcloud       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementatie Stappen

### Stap 1: Uitbreiden MarketplaceSettings Type

**Bestand**: `src/types/marketplace.ts`

Nieuwe VVB-specifieke instellingen toevoegen aan de interface:

```typescript
export interface MarketplaceSettings {
  // ... bestaande velden ...
  
  // VVB (Verzenden via Bol) instellingen
  vvbEnabled?: boolean;           // VVB labels aan/uit
  vvbMaxAmount?: number;          // Max orderbedrag voor VVB (bijv. 300)
  vvbFallbackProvider?: string;   // 'sendcloud' of 'myparcel' voor dure orders
  vvbDefaultCarrier?: string;     // Standaard carrier voor VVB (bijv. 'POSTNL')
  vvbDefaultDeliveryCode?: string; // Bijv. '1-2d'
  
  // Automatische verzendbevestiging
  autoConfirmShipment?: boolean;  // Auto bevestigen naar Bol.com
}
```

---

### Stap 2: Nieuwe Edge Function - create-bol-vvb-label

**Bestand**: `supabase/functions/create-bol-vvb-label/index.ts`

Nieuwe edge function die VVB labels aanmaakt via Bol.com API:

```typescript
// Bol.com Transporter Labels API
// POST /retailer/orders/{orderId}/transporter-labels
// Vereist: order-item-id's + carrier info

interface VVBLabelRequest {
  order_id: string;           // SellQo order ID
  carrier?: string;           // PostNL, DHL, etc.
  delivery_code?: string;     // 1-2d, 2-3d, etc.
}

// Stappen:
// 1. Haal order op met marketplace_order_id
// 2. Haal Bol.com credentials op via marketplace_connection_id
// 3. Call Bol.com /orders/{orderId}/shipment API
// 4. Genereer VVB label via /transporter-labels endpoint
// 5. Update order met tracking info + label URL
```

Bol.com API endpoints gebruikt:
- `POST /retailer/orders/{orderId}/shipment` - Verzendbevestiging
- `POST /retailer/transporter-labels` - VVB label genereren (async)
- `GET /retailer/transporter-labels/{labelId}` - Label PDF ophalen

---

### Stap 3: Nieuwe Edge Function - confirm-bol-shipment

**Bestand**: `supabase/functions/confirm-bol-shipment/index.ts`

Bevestigt een verzending naar Bol.com met track & trace:

```typescript
interface ConfirmShipmentRequest {
  order_id: string;           // SellQo order ID
  tracking_number: string;    // Track & trace code
  carrier: string;            // Carrier naam (PostNL, DHL, etc.)
  tracking_url?: string;      // Optionele tracking URL
}

// Bol.com API: POST /retailer/orders/{orderId}/shipment
// Body: { orderItems: [{ orderItemId, transport: { track-and-trace, carrier } }] }
```

---

### Stap 4: Uitbreiden create-shipping-label Edge Function

**Bestand**: `supabase/functions/create-shipping-label/index.ts`

Intelligente routing toevoegen gebaseerd op orderbron en bedrag:

```typescript
// Na het ophalen van de order, check voor Bol.com orders:

if (order.marketplace_source === 'bol_com' && order.marketplace_connection_id) {
  // Haal marketplace connection settings op
  const { data: connection } = await supabase
    .from('marketplace_connections')
    .select('settings')
    .eq('id', order.marketplace_connection_id)
    .single();
  
  const settings = connection?.settings;
  
  if (settings?.vvbEnabled) {
    const maxAmount = settings.vvbMaxAmount || 0;
    
    if (order.total <= maxAmount) {
      // Gebruik VVB voor deze order
      // Roep create-bol-vvb-label aan
      const { data } = await supabase.functions.invoke('create-bol-vvb-label', {
        body: { order_id: order.id }
      });
      return Response(data);
    }
    // Anders: val door naar Sendcloud/MyParcel
  }
}

// Bestaande Sendcloud/MyParcel logica...
```

---

### Stap 5: Admin UI - Bol.com VVB Instellingen

**Bestand**: `src/components/marketplace/BolComSettings.tsx` (nieuw of uitbreiden)

UI component voor VVB configuratie in de Bol.com connectie settings:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Verzenden via Bol (VVB)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ☑ VVB labels inschakelen                                      │
│                                                                 │
│  Maximum orderbedrag voor VVB:                                  │
│  ┌────────────────┐                                             │
│  │ € 300          │  ← Instelbare threshold                    │
│  └────────────────┘                                             │
│                                                                 │
│  ℹ️ Orders boven dit bedrag worden via Sendcloud verzonden      │
│     zodat je verzekering kunt toevoegen.                        │
│                                                                 │
│  Fallback verzendprovider:                                      │
│  ┌────────────────┐                                             │
│  │ Sendcloud    ▼ │                                             │
│  └────────────────┘                                             │
│                                                                 │
│  ☑ Automatisch verzending bevestigen naar Bol.com              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Stap 6: Automatische Trigger bij Label Creatie

Wanneer een Sendcloud/MyParcel label wordt aangemaakt voor een Bol.com order, automatisch de verzending bevestigen naar Bol.com:

**Update in**: `supabase/functions/create-shipping-label/index.ts`

```typescript
// Na succesvolle label creatie via Sendcloud/MyParcel:

if (order.marketplace_source === 'bol_com' && labelResult.success) {
  const settings = connection?.settings;
  
  if (settings?.autoConfirmShipment) {
    // Automatisch Bol.com verzending bevestigen
    await supabase.functions.invoke('confirm-bol-shipment', {
      body: {
        order_id: order.id,
        tracking_number: labelResult.tracking_number,
        carrier: labelResult.carrier,
        tracking_url: labelResult.tracking_url
      }
    });
  }
}
```

---

## Database Wijzigingen

Geen nieuwe tabellen nodig! De instellingen worden opgeslagen in de bestaande `marketplace_connections.settings` JSONB kolom.

---

## Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `supabase/functions/create-bol-vvb-label/index.ts` | VVB label generatie via Bol.com API |
| `supabase/functions/confirm-bol-shipment/index.ts` | Verzendbevestiging naar Bol.com |
| `src/components/marketplace/BolVVBSettings.tsx` | UI voor VVB instellingen |

## Te Wijzigen Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/types/marketplace.ts` | VVB settings toevoegen aan interface |
| `supabase/functions/create-shipping-label/index.ts` | Routing logica voor Bol.com orders |
| `src/components/marketplace/BolComSettingsDialog.tsx` | VVB settings sectie toevoegen |

---

## Flow Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ORDER VERWERKING FLOW                                │
└──────────────────────────────────────────────────────────────────────────────┘

     Bol.com Order                          Webshop Order
          │                                      │
          ▼                                      ▼
   ┌─────────────┐                        ┌─────────────┐
   │ sync-bol-   │                        │ Stripe/Bank │
   │ orders      │                        │ Transfer    │
   └──────┬──────┘                        └──────┬──────┘
          │                                      │
          └────────────┬─────────────────────────┘
                       │
                       ▼
               ┌───────────────┐
               │ Order in      │
               │ SellQo        │
               └───────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │ Medewerker    │
               │ klikt "Label" │
               └───────┬───────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   create-shipping-label     │
         │                             │
         │  Is Bol.com order?          │
         │      │                      │
         │      ├── Nee ───────────────┼─────────────┐
         │      │                      │             │
         │      └── Ja                 │             │
         │          │                  │             │
         │    VVB enabled?             │             │
         │      │                      │             │
         │      ├── Nee ───────────────┼─────────────┤
         │      │                      │             │
         │      └── Ja                 │             │
         │          │                  │             │
         │    Order ≤ max?             │             │
         │      │                      │             │
         │      ├── Nee ───────────────┼─────────────┤
         │      │                      │             │
         │      └── Ja                 │             ▼
         │          │                  │     ┌───────────────┐
         │          ▼                  │     │  Sendcloud/   │
         │  ┌───────────────┐          │     │  MyParcel     │
         │  │ VVB Label via │          │     └───────┬───────┘
         │  │ Bol.com API   │          │             │
         │  └───────┬───────┘          │             │
         │          │                  │             │
         │          ▼                  │             ▼
         │  ┌───────────────┐          │     ┌───────────────┐
         │  │ Auto confirm  │          │     │ Auto confirm  │
         │  │ naar Bol.com  │          │     │ naar Bol.com  │
         │  └───────────────┘          │     │ (als enabled) │
         │                             │     └───────────────┘
         └─────────────────────────────┘
```

---

## Technische Details

### Bol.com API Endpoints

**1. Verzending bevestigen:**
```
POST /retailer/orders/{orderId}/shipment
Content-Type: application/vnd.retailer.v10+json

{
  "orderItems": [{
    "orderItemId": "1234567890",
    "transport": {
      "trackAndTrace": "3STEST123456789",
      "transporterCode": "TNT" // of "POSTNL", "DHL", etc.
    }
  }]
}
```

**2. VVB Label aanmaken:**
```
POST /retailer/transporter-labels
Content-Type: application/vnd.retailer.v10+json

{
  "orderItems": [{
    "orderItemId": "1234567890"
  }],
  "shippingLabelOfferId": "...", // Ophalen via /shipping-labels endpoint
  "transporterCode": "POSTNL"
}
```

**3. Label PDF ophalen:**
```
GET /retailer/transporter-labels/{labelId}
Accept: application/pdf
```

---

## Resultaat na Implementatie

✅ **VVB Labels**: Direct vanuit SellQo Bol.com VVB labels genereren
✅ **Bedrag Threshold**: Configureerbaar max bedrag (bijv. €300) voor VVB
✅ **Fallback naar Sendcloud**: Automatisch voor dure orders met verzekering
✅ **Auto Verzendbevestiging**: Track & trace automatisch naar Bol.com
✅ **Unified UI**: Alle labels via dezelfde "Verzend" knop in order detail
✅ **Geen Extra Kosten**: VVB labels via Bol.com zijn goedkoper dan Sendcloud

---

## Samenvatting

| Feature | Status |
|---------|--------|
| VVB label generatie | 🆕 Nieuw te bouwen |
| Max bedrag threshold | 🆕 Nieuw te bouwen |
| Sendcloud fallback | ✅ Bestaand, routing toevoegen |
| Auto verzendbevestiging | 🆕 Nieuw te bouwen |
| Admin UI instellingen | 🆕 Nieuw te bouwen |

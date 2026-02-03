

# Plan: Bol.com Order Sync Fixen - Volledige Order Details Ophalen

## Geïdentificeerde Problemen

### Probleem 1: Ongeldige API Statussen
De Bol.com Retailer API v10 accepteert alleen deze status filters:
- `OPEN`
- `SHIPPED`  
- `ALL`

De code vraagt om `CANCELLED` en `RETURNED` → resulteert in 400 errors.

### Probleem 2: Ontbrekende Order Details
De `/orders` endpoint (lijst) geeft alleen basis-info per order:
```json
{
  "orders": [
    { "orderId": "C00005N41C" }  // Geen orderItems, geen prijzen!
  ]
}
```

Voor volledige details (incl. `orderItems`, prijzen, klantgegevens) moet je per order de detail-endpoint aanroepen:
```
GET /orders/{orderId}
```

### Probleem 3: Subtotal Berekening Faalt
Omdat `orderItems` leeg is bij de lijst-response, wordt `subtotal = 0` berekend, maar NULL wordt doorgegeven waardoor de NOT NULL constraint faalt.

## Oplossing

### Wijziging in sync-bol-orders/index.ts

**Stap 1**: Status filters aanpassen
```typescript
// Oud (fout):
const statuses = ['OPEN', 'SHIPPED', 'CANCELLED', 'RETURNED']

// Nieuw (correct):
const statuses = ['OPEN', 'SHIPPED', 'ALL']  // ALL voor historisch
// Of beter: alleen 'ALL' voor historical import
```

**Stap 2**: Per order de details ophalen
```typescript
// Na het ophalen van de order-lijst:
for (const orderSummary of ordersData.orders || []) {
  // Haal volledige order details op
  const detailResponse = await fetch(
    `${BOL_API_BASE}/orders/${orderSummary.orderId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json'
      }
    }
  )
  
  if (detailResponse.ok) {
    const fullOrder = await detailResponse.json()
    bolOrders.push(fullOrder)  // Nu met orderItems en prijzen
  }
}
```

**Stap 3**: Robuuste subtotal berekening
```typescript
// Bereken subtotal met fallback naar 0
const subtotal = (bolOrder.orderItems || []).reduce((sum, item) => {
  const price = item.unitPrice || item.offerPrice || 0
  return sum + (item.quantity * price)
}, 0) || 0  // Fallback naar 0 als alles faalt
```

**Stap 4**: Rate limiting toevoegen
Bol.com heeft rate limits, dus pauzes tussen API calls:
```typescript
// Kleine delay tussen order detail calls om rate limits te voorkomen
await new Promise(resolve => setTimeout(resolve, 200))
```

## Gewijzigde BolOrder Interface

De API response structuur is anders dan verwacht:

```typescript
interface BolOrder {
  orderId: string
  orderPlacedDateTime: string
  pickupPoint?: boolean
  orderItems: Array<{
    orderItemId: string
    quantity: number
    unitPrice: number      // Niet offerPrice!
    totalPrice?: number
    product: {
      ean: string
      title: string
    }
    fulfilment?: {
      method: 'FBR' | 'FBB'
    }
  }>
  shipmentDetails?: {
    firstName?: string
    surname?: string
    email?: string
    // etc.
  }
}
```

## Historische Import Strategie

Voor de initiële historische import met `ALL` status:

```typescript
// Gebruik 'ALL' voor complete historische import
const url = `${BOL_API_BASE}/orders?fulfilment-method=${method}&status=ALL&created-after=${startDate.toISOString()}`
```

Dit haalt alle orders op (OPEN, SHIPPED, en reeds afgeronde) in één call.

## Paginatie Ondersteuning

Bol.com API pagineert resultaten (max 50 per page). Toevoegen:

```typescript
let page = 1
let hasMore = true

while (hasMore) {
  const url = `${BOL_API_BASE}/orders?fulfilment-method=${method}&status=ALL&page=${page}`
  const response = await fetch(url, { headers })
  const data = await response.json()
  
  orders.push(...(data.orders || []))
  hasMore = data.orders?.length === 50  // Bol.com default page size
  page++
  
  // Rate limit
  await new Promise(r => setTimeout(r, 500))
}
```

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-bol-orders/index.ts` | Fix statuses, fetch order details, paginatie, rate limiting |

## Verwacht Resultaat

Na deze fix:
1. Geen API errors meer voor ongeldige statussen
2. Alle historische orders worden opgehaald met volledige details
3. Order items met prijzen worden correct geïmporteerd
4. Subtotal wordt correct berekend (geen NULL errors)
5. Rate limiting voorkomt API throttling


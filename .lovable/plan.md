
# Analyse: VVB Label Aanmaken Mislukt met 400 Error

## Kernprobleem

De Bol.com VVB label creatie faalt met een **400 Bad Request** omdat de **`marketplace_order_item_id`** niet is opgeslagen bij de order items.

## Bewijs uit de Database

```sql
-- Order items voor Bol.com orders:
order_id: 029e4f30-c726-467b-9660-e4450e8bffb1
marketplace_order_item_id: NULL  <-- PROBLEEM!

order_id: 94b19eb0-9b35-4f75-8ad2-6874987a9143
marketplace_order_item_id: NULL  <-- PROBLEEM!
```

## Waar het Misgaat

### 1. Edge Function Check (create-bol-vvb-label)
Regel 145-154 in `create-bol-vvb-label`:
```typescript
const bolOrderItemIds = orderItems
  .filter((item) => item.marketplace_order_item_id)  // Filter items met ID
  .map((item) => item.marketplace_order_item_id);

if (bolOrderItemIds.length === 0) {
  return new Response(
    JSON.stringify({ error: "No order items with Bol.com IDs found" }),
    { status: 400, ...}  // <-- DIT IS DE 400 ERROR
  );
}
```

### 2. Ontbrekende Mapping (sync-bol-orders)
Regel 417-424 in `sync-bol-orders`:
```typescript
const orderItems = (bolOrder.orderItems || []).map((item) => ({
  order_id: newOrder.id,
  product_name: item.product?.title || `EAN: ${item.ean}`,
  product_sku: item.ean || item.product?.ean,
  quantity: item.quantity,
  unit_price: item.unitPrice ?? item.offerPrice ?? 0,
  total_price: item.quantity * (item.unitPrice ?? item.offerPrice ?? 0)
  // ONTBREEKT: marketplace_order_item_id: item.orderItemId
}))
```

De Bol.com API response bevat `orderItemId` per item, maar deze wordt NIET opgeslagen in de database.

## Oplossing

### Stap 1: Fix sync-bol-orders Edge Function

Voeg `marketplace_order_item_id` toe aan de order items mapping:

```typescript
const orderItems = (bolOrder.orderItems || []).map((item) => ({
  order_id: newOrder.id,
  marketplace_order_item_id: item.orderItemId,  // <-- TOEVOEGEN
  product_name: item.product?.title || `EAN: ${item.ean || item.product?.ean || 'Unknown'}`,
  product_sku: item.ean || item.product?.ean,
  quantity: item.quantity,
  unit_price: item.unitPrice ?? item.offerPrice ?? 0,
  total_price: item.quantity * (item.unitPrice ?? item.offerPrice ?? 0)
}))
```

### Stap 2: Update Bestaande Orders

Voor orders die al geimporteerd zijn ZONDER de order item IDs, moeten we deze handmatig bijwerken. Twee opties:

**Optie A: Handmatige re-sync**
Verwijder de bestaande orders en sync opnieuw (data wordt correct opnieuw geimporteerd).

**Optie B: Backfill via API call**
Maak een functie die bestaande orders ophaalt uit Bol.com en de ontbrekende `marketplace_order_item_id` bijwerkt.

Aanbeveling: **Optie A** is eenvoudiger en veiliger voor de 2 orders die nu in het systeem staan.

## Impact

| Wat | Impact |
|-----|--------|
| Nieuwe orders | VVB labels werken direct na fix |
| Bestaande orders | Moeten verwijderd en opnieuw gesynced worden |
| Andere functionaliteit | Geen impact |

## Bestanden die Gewijzigd Worden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-bol-orders/index.ts` | Voeg `marketplace_order_item_id: item.orderItemId` toe |

## Na Implementatie

1. Deploy edge function
2. Verwijder bestaande Bol.com orders (2 stuks)
3. Klik "Synchroniseer Nu" om orders opnieuw te importeren
4. VVB Label Aanmaken werkt nu correct

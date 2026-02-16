

# Handmatig Bol.com Order Accepteren

## Wat wordt er gedaan

Een "Order Accepteren" knop toevoegen aan de Bol.com Acties kaart op de orderdetailpagina, plus een kritieke bug fixen in de edge function.

## Bug in edge function

Het bestand `supabase/functions/accept-bol-order/index.ts` heeft een **dubbele variabele declaratie** op regels 140-142:

```text
const acceptResult = JSON.parse(responseText)    // regel 140
const acceptResult = await acceptResponse.json() // regel 142
```

Dit veroorzaakt een runtime crash. Daarnaast ontbreken de uitgebreide CORS headers.

## Wijzigingen

### 1. `supabase/functions/accept-bol-order/index.ts`
- Verwijder de dubbele `const acceptResult` declaratie (regel 142) -- behoud alleen de `JSON.parse(responseText)` variant (regel 140)
- CORS headers bijwerken met de uitgebreide set (inclusief `x-supabase-client-platform`)

### 2. `src/components/admin/BolActionsCard.tsx`
- Een "Order Accepteren" knop toevoegen die zichtbaar is wanneer de order nog niet geaccepteerd is (`sync_status` is niet `accepted` en niet `shipped`)
- De knop roept de `accept-bol-order` edge function aan met `order_id` en `connection_id` (uit `order.marketplace_connection_id`)
- Na succesvolle acceptatie wordt de order data gerefresht
- Loading state en foutafhandeling met toast notificaties

### Verwachte UI

In de Bol.com Acties kaart verschijnt een groene "Order Accepteren" knop boven de VVB Label knop. Na acceptatie verdwijnt de knop en toont de status "Geaccepteerd".

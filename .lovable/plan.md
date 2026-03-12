

## Plan: Gift card support in storefront-api

### Database migration

De `storefront_cart_items` tabel heeft momenteel geen `gift_card_metadata` kolom. We moeten er een toevoegen:

```sql
ALTER TABLE public.storefront_cart_items 
ADD COLUMN gift_card_metadata jsonb DEFAULT NULL;
```

### Wijzigingen in `supabase/functions/storefront-api/index.ts`

**1. `cartAddItem` (regel ~1107-1158)**

- Haal `product_type` op bij het laden van het product (voeg `product_type` toe aan de select)
- Als `product_type === 'gift_card'`:
  - Gebruik `params.amount` als `unitPrice` i.p.v. product/variant prijs
  - Negeer `variant_id` (zet op null)
  - Skip voorraadcontrole (gift cards zijn digitaal)
  - Gift card items worden NIET samengevoegd met bestaande items (elke gift card is uniek — altijd een nieuw cart item)
  - Sla `gift_card_metadata` op in het cart item record

**2. `cartGet` (regel ~1061-1105)**

- Voeg `gift_card_metadata` toe aan de select van `storefront_cart_items`
- Voeg `product_type` toe aan de product select
- Geef `gift_card_metadata` en `product_type` mee in de cart item response

**3. `checkoutPlaceOrder` (regel ~1281-1426)**

- Na het aanmaken van order items: sla `gift_card_metadata` op in `order_items` voor gift card items
- Na het plaatsen van de order: detecteer gift card items en roep `process-gift-card-order` aan via `supabase.functions.invoke`
- Verzendkosten: als ALLE items in de cart `product_type === 'gift_card'` zijn, forceer `shippingCost = 0` (ongeacht geselecteerde verzendmethode). In dat geval is `shipping_method_id` optioneel.

**4. Order items insert (regel ~1356-1366)**

- Voeg `gift_card_metadata` toe aan de order items insert voor gift card producten
- Dit vereist dat we `product_type` beschikbaar hebben per cart item (via de cart response)

### Bestanden
- **Database**: 1 migratie — `gift_card_metadata` kolom toevoegen aan `storefront_cart_items`
- **Edge Function**: `supabase/functions/storefront-api/index.ts` — 4 functies aanpassen (`cartAddItem`, `cartGet`, `checkoutPlaceOrder`, order items insert)


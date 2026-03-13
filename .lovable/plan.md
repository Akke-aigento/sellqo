

## Bug: Order wordt aangemaakt vóór betaling + dubbele stock decrement

### Probleem

In `checkoutPlaceOrder` (storefront-api) worden bij Stripe-betalingen de volgende acties uitgevoerd **voordat** de klant betaalt:

1. **Order aangemaakt** met `payment_status: 'pending'` — op zich OK
2. **Stock verlaagd** — fout, want als de klant annuleert is de stock weg
3. **Cart geleegd** — fout, klant kan niet opnieuw afrekenen
4. **Kortingscode gebruik geregistreerd** — fout, code is "opgebruikt" zonder betaling
5. **Gift cards verwerkt** — fout, gift cards geactiveerd zonder betaling

Daarnaast decrementeert de **Stripe webhook** (`stripe-connect-webhook`) de stock **nogmaals** bij `checkout.session.completed`, dus bij succesvolle betaling wordt stock dubbel afgetrokken.

### Oplossing

**Bestand: `supabase/functions/storefront-api/index.ts`** — `checkoutPlaceOrder`

Voor Stripe betalingen (wanneer `payment_method === 'stripe'`), verplaats de volgende acties naar **na** betaling (d.w.z. niet uitvoeren in `checkoutPlaceOrder`):

1. **Stock decrement** (regels 1476-1483): Skip als `payment_method === 'stripe'` — de webhook doet dit al
2. **Cart clearing** (regels 1507-1508): Skip als `payment_method === 'stripe'` — verplaats naar webhook
3. **Kortingscode usage** (regels 1449-1453): Skip als `payment_method === 'stripe'` — verplaats naar webhook
4. **Gift card processing** (regels 1487-1504): Skip als `payment_method === 'stripe'` — verplaats naar webhook

De order + order_items mogen wel alvast aangemaakt worden (Stripe heeft de `order_id` nodig voor metadata).

**Bestand: `supabase/functions/stripe-connect-webhook/index.ts`** — `checkout.session.completed`

Voeg toe na succesvolle betaling:

1. **Cart opruimen**: Zoek de cart op via `order_id` metadata of `cart_id` (opslaan in order metadata) en verwijder items + cart
2. **Kortingscode usage registreren**: Lees `discount_code` en `discount_amount` van de order, zoek de `discount_code_id` op, en insert in `discount_code_usage` + increment `usage_count`
3. **Gift card processing**: Trigger `process-gift-card-order` voor orders met gift card items
4. **Stock decrement**: Blijft zoals het is (al in webhook)

Om de cart_id beschikbaar te maken in de webhook, sla `cart_id` op in de Stripe session metadata (naast `order_id` en `tenant_id`).

**Voor bank_transfer en free (€0) betalingen**: deze acties blijven in `checkoutPlaceOrder` omdat daar geen webhook bij betrokken is.

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Stock/cart/korting/gift cards conditioneel skippen voor Stripe |
| `supabase/functions/stripe-connect-webhook/index.ts` | Cart clearing, korting usage, gift card processing toevoegen |

### Checkout session expired

Een bijkomend voordeel: als de Stripe session verloopt (klant betaalt niet), blijft de order staan met `payment_status: pending` maar:
- Stock is niet verlaagd → geen phantom voorraadverlies
- Cart bestaat nog → klant kan opnieuw proberen
- Kortingscode is niet opgebruikt → klant kan code hergebruiken


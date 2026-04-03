

## Implementatie: Stateful multi-step checkout contract

### Overzicht

De volledige checkout sectie van `storefront-api/index.ts` (regels 1316-1583) wordt vervangen door een stateful multi-step flow die het contract exact volgt. Geen database migratie nodig — checkout status wordt afgeleid uit order data.

### Kernwijzigingen

**1. `checkout_start` — Cart → Order conversie**
- Maakt een order aan vanuit de cart (met `status: 'pending'`, `customer_email: 'checkout@pending.temp'`)
- Maakt order_items aan uit cart items
- Retourneert `order_id` + `available_payment_methods` + `available_shipping_methods`
- Fix kolom bugs: `tax_amount` i.p.v. `tax`, `total_price` i.p.v. `total`, `product_sku` i.p.v. `sku`

**2. Nieuwe acties**

| Actie | Wat |
|---|---|
| `checkout_customer` | Email/naam/telefoon opslaan, klant aanmaken/zoeken |
| `checkout_address` | Shipping/billing adres opslaan met validatie |
| `checkout_shipping` | Verzendmethode selecteren, kosten berekenen |
| `checkout_complete` | Stripe session of bankgegevens retourneren |
| `checkout_get_order` | Volledige order status ophalen |
| `checkout_apply_discount` | Kortingscode toepassen |
| `checkout_remove_discount` | Kortingscode verwijderen |

**3. Backward compat**
- `checkout_place_order` en `checkout_create_session` blijven werken — delegeren intern naar de nieuwe stappen
- `checkout_set_addresses` detecteert of `order_id` aanwezig is en routeert naar nieuwe of oude flow

**4. Error handling**
Alle errors volgen het contract format:
```json
{ "success": false, "error": { "code": "CART_EMPTY", "message": "..." } }
```
Validation errors bevatten ook een `fields` object.

**5. Stock decrement**
Gebeurt alleen in `checkout_complete`, niet bij `checkout_start`, zodat klanten kunnen terug-navigeren.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Regels 1316-1583 vervangen + nieuwe acties registreren in switch (regels 1725-1732) |

### Geen database wijzigingen nodig
Checkout status wordt afgeleid uit order data:
- `checkout_started` = order bestaat, geen customer_email
- `customer_saved` = customer_email ingevuld
- `address_saved` = shipping_address ingevuld
- `shipping_selected` = shipping_method_id ingevuld
- `payment_pending` = payment_method ingevuld
- `payment_completed` = payment_status = 'paid'

### Nieuwe switch registraties (toevoegen aan regels 1725-1732)
```
case 'checkout_start': ...
case 'checkout_customer': ...
case 'checkout_address': ...
case 'checkout_shipping': ...
case 'checkout_complete': ...
case 'checkout_get_order': ...
case 'checkout_apply_discount': ...
case 'checkout_remove_discount': ...
// Legacy compat
case 'checkout_set_addresses': ...
case 'checkout_get_shipping_options': ...
case 'checkout_get_payment_methods': ...
case 'checkout_place_order': ...
case 'checkout_create_session': ...
case 'checkout_get_confirmation': ...
```


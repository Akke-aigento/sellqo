
## Refactor: Checkout flow naar multi-step stateful contract

### Huidige situatie

De checkout is nu een **stateless multi-call** flow: de order wordt pas aangemaakt bij `checkout_place_order`. Tussenstappen (`checkout_set_addresses`) doen niets server-side. Er zijn ook meerdere kolombug's:
- `tax` → moet `tax_amount` zijn
- `source` kolom bestaat niet
- `total` → moet `total_price` zijn in order_items
- `sku` → moet `product_sku` zijn in order_items

### Nieuw contract

De checkout wordt **stateful**: order wordt aangemaakt bij `checkout_start` en elke stap update die order in de database.

```
Cart → checkout_start → Order (checkout_status: checkout_started)
  → checkout_customer → Order (checkout_status: customer_saved)
  → checkout_address → Order (checkout_status: address_saved)
  → checkout_shipping → Order (checkout_status: shipping_selected)
  → checkout_complete → Stripe redirect of bankgegevens
```

### Database migratie

```sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_status text DEFAULT null;
```

`checkout_status` trackt de checkout-voortgang (`checkout_started`, `customer_saved`, `address_saved`, `shipping_selected`, `payment_pending`). `status` blijft `pending` tot betaling compleet is.

### Nieuwe/herschreven functies in `storefront-api/index.ts`

| Actie | Wat het doet |
|---|---|
| `checkout_start` | Cart → order aanmaken, `checkout_status: checkout_started`, retourneert order_id + items + available payment/shipping methods |
| `checkout_customer` | Email/naam/telefoon opslaan op order, `checkout_status: customer_saved` |
| `checkout_address` | Shipping/billing adres opslaan op order, `checkout_status: address_saved` |
| `checkout_shipping` | Shipping method selecteren, kosten berekenen, `checkout_status: shipping_selected` |
| `checkout_complete` | Betaalmethode selecteren + afronden: Stripe session of bankgegevens retourneren, `checkout_status: payment_pending` |
| `checkout_get_order` | Huidige order status ophalen (voor refresh/polling) |
| `checkout_apply_discount` | Kortingscode toepassen op order |
| `checkout_remove_discount` | Kortingscode verwijderen van order |

### Fix kolom bugs

- Order insert: `tax_amount` i.p.v. `tax`, verwijder `source`
- Order items insert: `total_price` i.p.v. `total`, `product_sku` i.p.v. `sku`

### Backward compatibility

Oude acties (`checkout_place_order`, `checkout_create_session`, `checkout_set_addresses`) worden behouden als aliassen die delegeren naar de nieuwe functies. Zo breken bestaande integraties niet.

### Error response format

Alle checkout errors volgen het contract:
```json
{ "success": false, "error": { "code": "CART_EMPTY", "message": "..." } }
```

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie | `checkout_status` kolom toevoegen |
| `supabase/functions/storefront-api/index.ts` | Alle checkout functies herschrijven + nieuwe acties registreren |

### Stock decrement & cart cleanup

Stock wordt pas gedecrement en cart wordt pas geleegd bij `checkout_complete` (niet bij `checkout_start`), zodat de klant kan terug navigeren.

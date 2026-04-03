

## Fix: `checkout_start` retourneert geen checkout_url

### Analyse

De checkout flow in `storefront-api` is opgebouwd als een multi-step proces:

1. **`checkout_start`** (regel 1318-1334) — Retourneert alleen een cart-samenvatting. Geen Stripe sessie, geen URL.
2. **`checkout_set_addresses`** — Adresgegevens instellen
3. **`checkout_get_shipping_options`** — Verzendopties ophalen
4. **`checkout_get_payment_methods`** — Betaalmethoden ophalen
5. **`checkout_place_order`** (regel 1372-1517) — Hier wordt pas de Stripe checkout sessie aangemaakt en een `payment_url` geretourneerd.

Het probleem: de frontend (Vanxcel) verwacht een **single-call checkout** (`checkout_start` → krijg URL), maar de API is ontworpen als een **multi-step flow** waar de URL pas bij `checkout_place_order` komt.

### Oplossing

Voeg een **`checkout_create_session`** action toe die een single-call shortcut biedt: cart valideren, order aanmaken, Stripe sessie creëren, en de `checkout_url` retourneren — alles in één call. Dit is wat headless frontends nodig hebben.

**Parameters:**
- `cart_id` (required)
- `email` (required)  
- `shipping_address` (required)
- `billing_address` (optional, fallback naar shipping)
- `phone` (optional)
- `shipping_method_id` (required)
- `payment_method` (required: `stripe` | `bank_transfer`)
- `success_url` (required — de frontend bepaalt de redirect)
- `cancel_url` (required)
- `customer_note` (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "...",
    "order_number": "ORD-2026-0042",
    "checkout_url": "https://checkout.stripe.com/c/pay/...",
    "payment_method": "stripe"
  }
}
```

### Technische aanpak

**`supabase/functions/storefront-api/index.ts`**

1. Nieuwe `checkoutCreateSession` functie toevoegen die:
   - Cart ophaalt en valideert
   - Tenant Stripe config checkt (`stripe_account_id`, `stripe_charges_enabled`)
   - Klant aanmaakt/vindt
   - Order aanmaakt (hergebruik logica van `checkoutPlaceOrder`)
   - Stripe checkout session aanmaakt met `success_url`/`cancel_url` uit params
   - Stock decrementeert en cart leegt
   - `checkout_url` retourneert

2. De bestaande `checkoutPlaceOrder` logica wordt hergebruikt — de nieuwe functie is in feite dezelfde flow maar accepteert `success_url`/`cancel_url` uit de params in plaats van hardcoded URLs.

3. Registreer `checkout_create_session` in de action switch.

4. Fix ook in de bestaande `checkoutPlaceOrder`: gebruik `params.success_url` / `params.cancel_url` als ze meegegeven worden, in plaats van hardcoded `origin` URLs.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | `checkout_create_session` action toevoegen + `checkoutPlaceOrder` success/cancel URL fix |

### Geen database wijzigingen nodig


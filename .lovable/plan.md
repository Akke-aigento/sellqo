

## Fix: Cart-gebaseerde checkout + werkende kortingscodes

### Probleem

1. **Spookorders**: `checkout_start` maakt direct een order + order_items aan met placeholder data (`checkout@pending.temp`). Als de klant de checkout verlaat → spookorder in het systeem. Er zijn er nu 2.
2. **Kortingscodes**: `checkoutApplyDiscount` roept `validateDiscountCode` aan die `max_discount_amount` NIET retourneert, maar `calculateDiscountValue` die waarde wél nodig heeft. Gevolg: maximum korting wordt nooit afgekapt.

### Aanpak

De checkout schakelt over van order-gebaseerd naar **cart-gebaseerd**. Alle checkout-data wordt op `storefront_carts` opgeslagen. Een order wordt ALLEEN aangemaakt bij:
- **Bank transfer / QR**: in `checkout_complete`
- **Stripe**: in de `stripe-connect-webhook` bij `checkout.session.completed`

### Stap 1: Database migratie

Checkout-velden toevoegen aan `storefront_carts`:

```sql
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS checkout_status text DEFAULT 'shopping';
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS customer_first_name text;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS customer_last_name text;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS billing_address jsonb;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS billing_same_as_shipping boolean DEFAULT true;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS shipping_method_id uuid;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS shipping_cost decimal(10,2) DEFAULT 0;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) DEFAULT 0;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS payment_method text;
```

(De tabel heeft al `discount_code` kolom.)

### Stap 2: Storefront API refactor

**`storefront-api/index.ts`** — alle checkout functies herschrijven:

| Functie | Nu | Wordt |
|---|---|---|
| `checkoutStart` | Maakt order + order_items aan | Berekent cart totalen, retourneert `cart_id` + betaal/verzendmethoden. Geen order. |
| `checkoutCustomer` | Update order | Update `storefront_carts` (email, naam, telefoon) |
| `checkoutAddress` | Update order | Update `storefront_carts` (shipping_address, billing_address) |
| `checkoutShipping` | Update order | Update `storefront_carts` (shipping_method_id, shipping_cost) |
| `checkoutComplete` | Maakt Stripe session met bestaande order | **Bank/QR**: maakt order + items nu pas aan, retourneert bankgegevens. **Stripe**: maakt ALLEEN Stripe session, slaat `stripe_session_id` op cart op, retourneert checkout_url. Geen order. |
| `checkoutApplyDiscount` | Update order | Update cart, fix: retourneer `max_discount_amount` uit `validateDiscountCode` |
| `checkoutRemoveDiscount` | Update order | Update cart |
| `checkoutGetOrder` | Leest order | Blijft — voor na-bestelling status check |

Alle endpoints accepteren `cart_id` i.p.v. `order_id` (behalve `checkoutGetOrder`).

**Helper: `createOrderFromCart`** — nieuwe functie die:
1. Cart + items ophaalt
2. Klant zoekt/aanmaakt
3. Order + order_items inserts
4. Cart markeert als `converted`
5. `usage_count` incrementeert bij discount
6. Retourneert het volledige order object

### Stap 3: Stripe webhook fix

**`stripe-connect-webhook/index.ts`** — `checkout.session.completed` handler:

Nu: zoekt order via `metadata.order_id` en zet `payment_status: 'paid'`.

Wordt: zoekt cart via `metadata.cart_id` (of `stripe_session_id`), roept `createOrderFromCart` aan met `payment_status: 'paid'`, decrementeert stock daarna.

Backward compat: als `metadata.order_id` aanwezig is (oude sessies), gebruik bestaande flow.

### Stap 4: Discount fix

`validateDiscountCode` retourneert nu ook `max_discount_amount` zodat `calculateDiscountValue` correct werkt.

### Stap 5: Spookorders opruimen

Data-operatie via insert tool:
```sql
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_email = 'checkout@pending.temp');
DELETE FROM orders WHERE customer_email = 'checkout@pending.temp';
```

### Stap 6: Legacy compat

`checkoutPlaceOrder` (single-call flow) werkt nog — intern doet hij alle stappen op de cart en roept `createOrderFromCart` aan het einde.

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie | Checkout-velden op `storefront_carts` |
| `supabase/functions/storefront-api/index.ts` | Alle checkout functies herschrijven naar cart-gebaseerd |
| `supabase/functions/stripe-connect-webhook/index.ts` | `checkout.session.completed` → cart-based order creation |


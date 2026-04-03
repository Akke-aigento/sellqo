

## Fix: Storefront API Checkout Bugs

### Geïdentificeerde bugs

**Bug 1: Stripe crasht op negatieve line items (KRITIEK)**
Regel 1649-1658: korting wordt als negatief `unit_amount` toegevoegd aan Stripe line items. Stripe staat dit NIET toe — `unit_amount` moet positief zijn. Dit verklaart de 500 error bij Stripe checkout.
Fix: Vervang negatieve line item door een Stripe `coupon` + `discounts` parameter.

**Bug 2: `increment_discount_usage` RPC bestaat niet**
Regel 1452: `supabase.rpc('increment_discount_usage', ...)` — deze database functie bestaat niet. Het `.catch()` swallowd de error, maar usage count wordt nooit geïncrementeerd.
Fix: Vervang door directe `UPDATE discount_codes SET usage_count = usage_count + 1 WHERE ...`.

**Bug 3: `.rpc().catch()` patroon**
Hoewel Supabase v2 `.catch()` ondersteunt op thenables, is het veiliger om `const { error } = await supabase.rpc(...)` te gebruiken. De huidige calls met `.catch(() => {})` werken, maar de `increment_discount_usage` call faalt stil.

**Bug 4: QR code mist `image_url`**
Regel 1738: alleen `payload` wordt geretourneerd, geen `image_url` voor de QR code.
Fix: Voeg een publieke QR-generatie URL toe.

**Bug 5: `checkout_discount` action alias mist**
Frontends zouden `checkout_discount` kunnen aanroepen, maar alleen `checkout_apply_discount` en `checkout_remove_discount` zijn geregistreerd. Voeg `checkout_discount` als alias toe.

### Technische aanpak

**`supabase/functions/storefront-api/index.ts`**

1. **Stripe discount fix** (regels 1648-1658): Verwijder negatieve line item. Voeg korting toe als aparte Stripe coupon:
```typescript
// In checkoutComplete, bij Stripe session create:
const sessionParams: any = {
  line_items: lineItems, // alleen positieve items
  mode: 'payment',
  success_url: successUrl,
  cancel_url: cancelUrl,
  customer_email: cart.customer_email,
  metadata: { cart_id: cartId, tenant_id: tenantId },
  payment_intent_data: { ... },
};

if (discountAmount > 0) {
  const coupon = await stripe.coupons.create({
    amount_off: Math.round(discountAmount * 100),
    currency: currency.toLowerCase(),
    duration: 'once',
    name: cart.discount_code || 'Korting',
  });
  sessionParams.discounts = [{ coupon: coupon.id }];
}
```

2. **`increment_discount_usage` fix** (regel 1450-1456): Vervang RPC door directe update:
```typescript
await supabase.from('discount_codes')
  .update({ usage_count: supabase.rpc(...) }) // Nee — gewoon:
// Use raw SQL-achtige increment via .rpc of direct:
const { error } = await supabase.rpc('increment_field', ...);
// Simpeler: direct update met bekende code
await supabase.from('discount_codes')
  .update({}) // Supabase heeft geen increment...
```
Omdat Supabase JS geen atomic increment ondersteunt: maak een simpele DB functie `increment_discount_usage` aan via migratie.

3. **QR image_url** (regel 1738): Voeg toe:
```typescript
image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`
```

4. **Alias toevoegen** in switch: `checkout_discount` → `checkout_apply_discount`

5. **RPC .catch() cleanup** in `createOrderFromCart` en `checkoutComplete`: vervang door `const { error } = await` patroon.

### Database migratie

Maak de ontbrekende `increment_discount_usage` functie aan:

```sql
CREATE OR REPLACE FUNCTION public.increment_discount_usage(_code text, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE discount_codes
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE tenant_id = _tenant_id AND code = _code;
END;
$$;
```

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie | `increment_discount_usage` functie aanmaken |
| `supabase/functions/storefront-api/index.ts` | Stripe coupon i.p.v. negatieve line item + QR image_url + discount usage fix + RPC cleanup + checkout_discount alias |


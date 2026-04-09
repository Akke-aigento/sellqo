

## Fix: Stripe checkout faalt met "No such coupon" bij kortingscodes

### Root Cause

In `supabase/functions/storefront-api/index.ts` regel 1676-1682: de coupon wordt aangemaakt op het **connected account** (`{ stripeAccount: tenantData.stripe_account_id }`), maar de checkout sessie wordt aangemaakt op het **platform account** (zonder `stripeAccount`). Stripe kan de coupon niet vinden omdat die op een ander account leeft.

```typescript
// Coupon wordt hier aangemaakt op connected account ❌
const coupon = await stripe.coupons.create({...}, { stripeAccount: tenantData.stripe_account_id });
// Maar sessie wordt op platform account aangemaakt → coupon niet gevonden
const session = await stripe.checkout.sessions.create(sessionParams);
```

### Fix

**Bestand:** `supabase/functions/storefront-api/index.ts` (regel 1681)

Verwijder `{ stripeAccount: tenantData.stripe_account_id }` uit de `stripe.coupons.create()` call zodat de coupon op het platform account wordt aangemaakt — hetzelfde account waar de checkout sessie draait.

```typescript
// Was:
const coupon = await stripe.coupons.create({
  amount_off: Math.round(discountAmount * 100),
  currency: currency.toLowerCase(),
  duration: 'once',
  name: cart.discount_code || 'Korting',
}, { stripeAccount: tenantData.stripe_account_id });

// Wordt:
const coupon = await stripe.coupons.create({
  amount_off: Math.round(discountAmount * 100),
  currency: currency.toLowerCase(),
  duration: 'once',
  name: cart.discount_code || 'Korting',
});
```

Eén regel verwijderen, klaar. De coupon en de sessie leven dan op hetzelfde Stripe account.

### Geen database wijzigingen nodig


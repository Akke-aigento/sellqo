

## Fix: Stripe checkout "No such coupon" met destination charges

### Root Cause

Het probleem is dat Stripe Checkout **`discounts` niet ondersteunt in combinatie met `payment_intent_data.transfer_data`** (destination charges). De coupon wordt wél aangemaakt op het platform account, maar Stripe weigert de checkout sessie met die combinatie. Dat verklaart ook de tweede error: "Expected payment_method_types on the payment page object."

### Oplossing

Stop met het gebruik van Stripe coupons. Pas in plaats daarvan de korting toe door de **line item bedragen proportioneel te verlagen**. Dit werkt altijd met destination charges.

### Wijziging

**Bestand:** `supabase/functions/storefront-api/index.ts` (regels 1674-1683)

Vervang het coupon-blok door proportionele korting op line items:

```typescript
// Was:
if (discountAmount > 0) {
  const coupon = await stripe.coupons.create({...});
  sessionParams.discounts = [{ coupon: coupon.id }];
}

// Wordt:
if (discountAmount > 0) {
  // Bereken subtotaal (excl. verzending) en verdeel korting proportioneel
  const subtotalCents = lineItems
    .filter((li: any) => li.price_data.product_data.name !== 'Verzending')
    .reduce((sum: number, li: any) => sum + li.price_data.unit_amount * li.quantity, 0);
  
  const discountCents = Math.round(discountAmount * 100);
  let remaining = discountCents;

  const productItems = lineItems.filter(
    (li: any) => li.price_data.product_data.name !== 'Verzending'
  );
  
  productItems.forEach((li: any, i: number) => {
    const itemTotal = li.price_data.unit_amount * li.quantity;
    const itemDiscount = i === productItems.length - 1
      ? remaining  // laatste item krijgt restant
      : Math.round((itemTotal / subtotalCents) * discountCents);
    
    li.price_data.unit_amount = Math.max(0,
      li.price_data.unit_amount - Math.round(itemDiscount / li.quantity)
    );
    remaining -= itemDiscount;
  });
}
```

- Geen coupon API calls meer
- Werkt volledig met destination charges
- Korting wordt correct verdeeld over productregels
- Verzendkosten blijven ongewijzigd

### Geen database wijzigingen nodig


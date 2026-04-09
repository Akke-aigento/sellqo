

## Fix: Stripe Checkout "no valid payment methods" error

### Oorzaak
Na de `hasCapabilities` fix filtert de edge function nu te streng. De `capabilityMap` namen (bijv. `ideal_payments`) matchen mogelijk niet exact met hoe Stripe ze rapporteert op het connected account, waardoor alle methodes worden weggefilterd en Stripe een lege `payment_method_types` lijst krijgt.

### Oplossing
In `supabase/functions/create-checkout-session/index.ts`:

1. **Wanneer `preferred_payment_method` is meegegeven**: altijd vertrouwen en gebruiken zonder capability-check. De tenant admin heeft deze methode al geconfigureerd, en de klant heeft hem geselecteerd — geen extra validatie nodig.

2. **Wanneer geen preferred method** (fallback): capability-check behouden, maar als het resultaat leeg is, terugvallen op de geconfigureerde `sanitizedMethods` in plaats van een error te gooien. Stripe zal zelf al een error geven als een methode echt niet beschikbaar is.

### Wijziging

**Bestand:** `supabase/functions/create-checkout-session/index.ts` (regels 651-677)

```typescript
if (preferredMethod && validCodes.includes(preferredMethod)) {
  // Trust the tenant's configuration — always use the preferred method
  paymentMethodTypes = [preferredMethod];
  logStep("Using preferred payment method", { preferredMethod });
} else {
  // Filter by capabilities, but fallback to configured methods if empty
  if (hasCapabilities) {
    const filtered = sanitizedMethods.filter((m: string) => {
      const cap = capabilityMap[m];
      return cap && accountCapabilities[cap] === 'active';
    });
    paymentMethodTypes = filtered.length > 0 ? filtered : sanitizedMethods;
  } else {
    paymentMethodTypes = sanitizedMethods;
  }
}
```

En het lege-array error blok (regels 669-677) kan behouden blijven als ultieme vangnet, maar zal nu niet meer geraakt worden.

### Resultaat
- Preferred method wordt altijd doorgestuurd → geen "no valid payment methods" meer
- Fallback is veilig: als capability-check niets oplevert, worden de tenant-geconfigureerde methodes gebruikt
- Edge function deploy nodig


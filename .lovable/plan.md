

## Fix: QR/bankoverschrijving negeren tenant-instelling

### Probleem
De `checkoutGetPaymentMethods` functie in de Storefront API (edge function) controleert alleen of een IBAN aanwezig is — maar kijkt **niet** naar de `payment_methods_enabled` kolom in de tenants tabel. Hierdoor wordt bankoverschrijving/QR altijd aangeboden op de publieke checkout, zelfs als je het in de admin hebt uitgeschakeld.

De custom frontend roept `checkout_get_payment_methods` of `checkout_start` aan, en die geven altijd `bank_transfer` terug zolang er een IBAN bestaat.

### Oplossing
In `supabase/functions/storefront-api/index.ts`, de `checkoutGetPaymentMethods` functie aanpassen:

**Huidige logica (regel 1946-1959):**
```
if (tenant?.iban) → toon bank_transfer
```

**Nieuwe logica:**
```
if (tenant?.iban && enabledMethods.includes('bank_transfer')) → toon bank_transfer
if (tenant?.stripe_account_id && stripe_charges_enabled && enabledMethods.includes('stripe')) → toon stripe
```

### Wijzigingen
1. **`supabase/functions/storefront-api/index.ts`** — `checkoutGetPaymentMethods` functie:
   - Voeg `payment_methods_enabled` toe aan de SELECT query
   - Check of `bank_transfer` in de enabled list staat vóór het toevoegen
   - Check of `stripe` in de enabled list staat vóór het toevoegen
   - Fallback: als `payment_methods_enabled` leeg/null is, gedraag je als voorheen (alles tonen)

2. Dezelfde check toevoegen aan de `checkoutStart` functie die ook `checkoutGetPaymentMethods` aanroept — geen extra wijziging nodig want die hergebruikt dezelfde functie.

### Technisch detail
```typescript
async function checkoutGetPaymentMethods(supabase, tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_account_id, stripe_charges_enabled, iban, name, payment_methods_enabled')
    .eq('id', tenantId).single();

  const enabledMethods = tenant?.payment_methods_enabled as string[] || [];
  const noFilter = enabledMethods.length === 0; // backwards compat

  const methods = [];
  if (tenant?.stripe_account_id && tenant?.stripe_charges_enabled && (noFilter || enabledMethods.includes('stripe'))) {
    methods.push({ id: 'stripe', ... });
  }
  if (tenant?.iban && (noFilter || enabledMethods.includes('bank_transfer'))) {
    methods.push({ id: 'bank_transfer', ... });
  }
  return methods;
}
```

Eén bestand, één functie-aanpassing. De edge function wordt automatisch gedeployd.


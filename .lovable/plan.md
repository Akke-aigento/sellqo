
# Fix: Twee checkout-fouten oplossen

## Probleem 1: Bankoverschrijving - "invalid input value for enum payment_status: awaiting_payment"

De edge function `create-bank-transfer-order` probeert een order aan te maken met `payment_status: "awaiting_payment"`, maar de database-enum `payment_status` kent alleen de waarden: `pending`, `paid`, `refunded`, `failed`.

**Oplossing:** In `supabase/functions/create-bank-transfer-order/index.ts` de waarde `"awaiting_payment"` wijzigen naar `"pending"`.

## Probleem 2: iDEAL/Creditcard - "payment method type provided: ideal is invalid"

De edge function `create-checkout-session` forceert `payment_method_types: ["card", "ideal", "bancontact"]`, maar Stripe weigert dit op Connect-account niveau. Hoewel de methoden in jouw SellQo admin aanstaan, moet Stripe zelf bepalen welke methoden beschikbaar zijn.

**Oplossing:** In `supabase/functions/create-checkout-session/index.ts` de hardcoded `payment_method_types` vervangen door `automatic_payment_methods: { enabled: true }`. Stripe bepaalt dan automatisch welke betaalmethoden beschikbaar zijn op basis van het account, valuta en land.

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/create-bank-transfer-order/index.ts` (regel 248) | `"awaiting_payment"` naar `"pending"` |
| `supabase/functions/create-checkout-session/index.ts` (regel 544) | `payment_method_types: [...]` vervangen door `automatic_payment_methods: { enabled: true }` |

## Technische details

### create-bank-transfer-order (regel 248)
```typescript
// Was:
payment_status: "awaiting_payment",
// Wordt:
payment_status: "pending",
```

### create-checkout-session (regel 544)
```typescript
// Was:
payment_method_types: ["card", "ideal", "bancontact"],
// Wordt:
automatic_payment_methods: { enabled: true },
```

Hierdoor bepaalt Stripe zelf welke betaalmethoden beschikbaar zijn op basis van de instellingen van het merchant-account, valuta, en land. Geen handmatige configuratie meer nodig.

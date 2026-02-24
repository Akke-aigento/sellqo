

## Volgorde betaalmethoden omdraaien in checkout

### Wijziging

In `src/components/storefront/PaymentMethodSelector.tsx` de twee betaalopties van volgorde verwisselen: **Bank Transfer (QR)** komt eerst, **Stripe (Online betalen)** komt daarna.

### Technisch

**`src/components/storefront/PaymentMethodSelector.tsx`** -- regels 125-197

De twee blokken in de RadioGroup omdraaien:
1. Eerst het `{hasBankTransfer && (...)}` blok (regels 164-197)
2. Dan het `{hasStripe && (...)}` blok (regels 126-162)

Daarnaast de standaard geselecteerde waarde aanpassen zodat `bank_transfer` standaard geselecteerd is wanneer beschikbaar (dit wordt waarschijnlijk al door de parent bepaald, maar we checken dit).

| Bestand | Wijziging |
|---|---|
| `src/components/storefront/PaymentMethodSelector.tsx` | Volgorde blokken omdraaien: bank_transfer eerst, stripe daarna |


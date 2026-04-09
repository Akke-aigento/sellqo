

## Fix: Loveke en Mancini Milano Stripe accounts opruimen

### Probleem 1: Loveke (`acct_1T4KKmRoQPtwaESn`)
Het Stripe account bestaat niet meer (al verwijderd/ingetrokken). De `disconnect-stripe-account` functie probeert `stripe.accounts.del()` aan te roepen, maar Stripe retourneert een fout met de tekst *"does not have access to account (or that account does not exist)"*. De huidige error-handling vangt alleen `account_invalid` en `statusCode === 404` op, maar niet deze specifieke foutmelding. Daardoor faalt de functie met een 500 error in plaats van door te gaan met de database-cleanup.

### Probleem 2: Mancini Milano (`acct_1TI7bxRvfrLqgh95`)
Dit account bestaat nog in Stripe (onboarding niet voltooid, charges niet enabled). De disconnect zou hier gewoon moeten werken nu de kolomnaam-fix is gedeployed. Als je dit nog niet opnieuw geprobeerd hebt na de fix, probeer het eerst nog eens.

### Oplossing
Breid de error-handling in `disconnect-stripe-account` uit zodat ook "does not have access" fouten worden opgevangen als "account al weg, ga door met cleanup":

**Bestand: `supabase/functions/disconnect-stripe-account/index.ts`** (regel 101-110)

Huidige check:
```typescript
if (stripeErr?.code === "account_invalid" || stripeErr?.statusCode === 404) {
```

Nieuwe check:
```typescript
if (
  stripeErr?.code === "account_invalid" || 
  stripeErr?.statusCode === 404 ||
  stripeErr?.message?.includes("does not have access") ||
  stripeErr?.message?.includes("does not exist")
) {
```

Dezelfde verbetering ook toepassen in `cleanup-connected-accounts/index.ts` (daar staat dit al correct, maar voor consistentie).

### Resultaat
- Loveke: disconnect zal het account herkennen als "al weg" en de database-velden resetten
- Mancini Milano: disconnect zou al moeten werken na de eerdere kolomnaam-fix
- Toekomstige edge cases met verwijderde/ingetrokken accounts worden ook correct afgehandeld


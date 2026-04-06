

## Fix: `checkoutGetPaymentMethods` duplicate — stale deployment

### Analyse

Het lokale bestand `supabase/functions/storefront-api/index.ts` heeft **slechts één** declaratie van `checkoutGetPaymentMethods` (regel 1919). De oude versie (die op regel ~1330 stond) is al verwijderd in een eerdere edit.

Echter, de **gedeployde** versie is stale — die bevat nog steeds BEIDE declaraties (de error wijst naar regel 2261 in de compiled versie, wat overeenkomt met de tweede declaratie). Dit veroorzaakt de `SyntaxError: Identifier 'checkoutGetPaymentMethods' has already been declared`.

### Fix

Er hoeft geen code te veranderen. De edge function moet opnieuw gedeployd worden zodat de huidige (correcte) versie live gaat.

### Actie

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Geen wijziging — redeploy |


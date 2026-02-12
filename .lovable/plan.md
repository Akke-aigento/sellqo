
# Fix: Gratis Maanden Geven zonder Stripe

## Probleem
De functie faalt met een 404 omdat de tenant (VanXcel) geen `stripe_subscription_id` heeft in de database. De huidige code vereist een Stripe-abonnement om maanden te verlengen, maar niet elke tenant heeft een Stripe-koppeling.

## Oplossing
De edge function `platform-gift-month` aanpassen zodat het ook werkt voor tenants zonder Stripe-abonnement. In dat geval wordt alleen de database direct bijgewerkt (trial_end en/of current_period_end verlengen).

## Wijzigingen

### `supabase/functions/platform-gift-month/index.ts`

**Huidige logica (faalt):**
1. Haal `stripe_subscription_id` en `current_period_end` op
2. Als geen `stripe_subscription_id` -> 404 error
3. Update Stripe subscription

**Nieuwe logica:**
1. Haal abonnement op inclusief `trial_end`, `current_period_end`, `stripe_subscription_id`
2. Als geen abonnement gevonden -> 404 error
3. Bereken nieuw einddatum op basis van het verste punt (trial_end, current_period_end, of nu)
4. Als er een `stripe_subscription_id` is -> update ook Stripe
5. Update altijd de database: `trial_end` en `current_period_end` verlengen
6. Log de admin actie

### Technische details

```text
Stroom:
  Abonnement ophalen
       |
  Geen abonnement? --> 404
       |
  Bereken startdatum = MAX(trial_end, current_period_end, NOW())
  Bereken nieuw einddatum = startdatum + X maanden
       |
  Heeft Stripe ID? --> Ja --> Update Stripe trial_end
       |
  Update database: trial_end + current_period_end
       |
  Log admin actie
```

Dit zorgt ervoor dat de functie werkt voor:
- Tenants met Stripe-abonnement (database + Stripe update)
- Tenants zonder Stripe-abonnement (alleen database update)

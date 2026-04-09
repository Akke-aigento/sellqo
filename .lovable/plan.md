

## Fix: EPS weghalen + Apple Pay zichtbaar maken

### Oorzaak EPS
In `create-checkout-session/index.ts` wordt `hasCapabilities` gebruikt op regels 652 en 657, maar die variabele is **nooit gedefinieerd**. Hierdoor is de waarde altijd `undefined` (falsy), waardoor de capability-check wordt overgeslagen. Stripe krijgt dan alle geconfigureerde methodes zonder validatie, en kan via "automatic payment methods" extra methodes zoals EPS tonen.

### Fix 1: `hasCapabilities` definiëren (edge function)
**Bestand:** `supabase/functions/create-checkout-session/index.ts`

Na het ophalen van `accountCapabilities` (rond regel 643), toevoegen:
```typescript
const hasCapabilities = Object.keys(accountCapabilities).length > 0;
```

Dit zorgt ervoor dat de capability-intersectie daadwerkelijk draait en alleen methodes met `active` status worden doorgestuurd naar Stripe.

### Fix 2: Apple Pay duidelijker in de selector
**Bestand:** `src/components/storefront/PaymentMethodSelector.tsx`

Het label voor de `card` methode aanpassen van "Creditcard" naar "Creditcard / Apple Pay" en de beschrijving naar "Visa, Mastercard, Apple Pay, Google Pay". Apple Pay werkt via Stripe's `card` capability — het is geen aparte methode, maar moet wel zichtbaar zijn voor de klant.

### Resultaat
- EPS verdwijnt van de Stripe checkout pagina (alleen actieve, geconfigureerde methodes)
- Apple Pay is duidelijk zichtbaar als optie voor de klant
- Geen database-migratie nodig, alleen code + edge function deploy



## Fix: Betaalmethode selector wordt overgeslagen

### Diagnose
Het probleem zit waarschijnlijk in een combinatie van twee zaken:

1. **`PublicTenant` type mist `stripe_payment_methods`** — het veld wordt wel opgehaald in de query maar zit niet in de TypeScript interface. De `(tenant as any).stripe_payment_methods` cast werkt op runtime, maar maakt het onduidelijk en foutgevoelig.

2. **Race condition met `handleCustomerDetailsSubmit`** — op regel 229 checkt de code `enabledPaymentMethods.length === 1`. De initiële state is `['card']` (lengte 1). Als de `useEffect` die de echte methodes laadt nog niet is uitgevoerd op het moment van klikken, wordt de betalingsstap volledig overgeslagen en gaat het direct naar Stripe met `card` als default. Maar doordat de edge function daarna capability-filtering doet en `card` omzet of `ideal` als fallback gebruikt, komt de gebruiker op een Stripe-pagina met alleen iDEAL.

### Oplossing

#### 1. `stripe_payment_methods` toevoegen aan `PublicTenant` interface
**Bestand:** `src/hooks/usePublicStorefront.ts`

Voeg `stripe_payment_methods: string[] | null;` toe aan de `PublicTenant` interface zodat het veld correct getypt is.

#### 2. Race condition fixen in ShopCheckout
**Bestand:** `src/pages/storefront/ShopCheckout.tsx`

- Verwijder de cast `(tenant as any)?.stripe_payment_methods` en gebruik direct `tenant?.stripe_payment_methods`
- In `handleCustomerDetailsSubmit`: gebruik de actuele tenant config direct in plaats van de state-variabele, zodat er geen window is waar de default `['card']` actief is
- Of beter: bereken `enabledPaymentMethods` als een `useMemo` afgeleid van `tenant`, niet als aparte state die async wordt bijgewerkt

#### 3. PaymentMethodSelector vangnet
**Bestand:** `src/components/storefront/PaymentMethodSelector.tsx`

Als `options.length <= 1`, in plaats van `null` teruggeven, toon dan gewoon de ene optie zodat de gebruiker altijd het payment step ziet en niet direct wordt doorgestuurd.

### Wijzigingen samengevat
1. `src/hooks/usePublicStorefront.ts` — type-fix
2. `src/pages/storefront/ShopCheckout.tsx` — `enabledPaymentMethods` wordt `useMemo` i.p.v. `useState` + `useEffect`, plus directe typed access
3. `src/components/storefront/PaymentMethodSelector.tsx` — verwijder de `<= 1` early return

### Resultaat
- Geen race condition meer: methodes worden altijd correct berekend uit tenant data
- Payment step wordt niet meer overgeslagen
- Gebruiker ziet altijd de betaalmethode-keuzes

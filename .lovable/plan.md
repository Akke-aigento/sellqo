

## Feature: Aparte betaalknoppen per Stripe-methode

### Idee
In plaats van één generieke "Online betalen" knop die naar Stripe stuurt (waar Stripe dan zelf kiest wat te tonen), krijgt de klant aparte keuzes: "Betaal met iDEAL", "Betaal met Creditcard / Apple Pay", "Betaal met Bancontact", etc. Elke keuze stuurt de klant direct naar Stripe met alleen die ene methode. Dit ziet er professioneler uit en lost het probleem op dat Stripe nu alleen iDEAL toont.

### Hoe het werkt

**Stap 1: PaymentMethod type uitbreiden**
`PaymentMethod` wordt uitgebreid van `'stripe' | 'bank_transfer'` naar `'ideal' | 'bancontact' | 'card' | 'klarna' | 'bank_transfer'`. Elke Stripe sub-methode wordt een eigen keuze.

**Stap 2: PaymentMethodSelector herschrijven**
- Haal de actieve Stripe sub-methodes op (uit tenant `stripe_payment_methods`)
- Toon per methode een aparte radio-optie met eigen icoon, naam en beschrijving:
  - iDEAL: iDEAL-icoon + "Direct betalen via je bank" + 🇳🇱
  - Creditcard: Visa/MC-icoon + "Creditcard, Apple Pay, Google Pay"
  - Bancontact: Bancontact-icoon + "Betalen met Bancontact" + 🇧🇪
  - Klarna: Klarna-icoon + "Achteraf betalen"
- QR/bankoverschrijving blijft als aparte optie onderaan

**Stap 3: ShopCheckout aanpassen**
- `handlePayment` stuurt de gekozen specifieke methode mee naar `create-checkout-session` als een nieuw veld `preferred_payment_method`
- Als de methode `bank_transfer` is, gaat het naar de bestaande QR-flow
- Anders gaat alles naar Stripe met die ene methode

**Stap 4: Edge function aanpassen**
In `create-checkout-session/index.ts`:
- Lees het nieuwe `preferred_payment_method` veld uit de request body
- Als dat gevuld is, gebruik `payment_method_types: [preferred_payment_method]` (alleen die ene methode)
- Als het niet gevuld is (fallback), gebruik de bestaande logica met alle tenant-methodes

**Stap 5: Storefront API — stripe_payment_methods doorgeven**
De checkout moet weten welke Stripe sub-methodes de tenant heeft ingeschakeld om de juiste knoppen te tonen. Dit kan via de bestaande `usePublicStorefront` hook die al tenant-data ophaalt — voeg `stripe_payment_methods` toe aan de query.

### Bestanden die wijzigen
1. `src/components/storefront/PaymentMethodSelector.tsx` — herschrijven met aparte knoppen
2. `src/pages/storefront/ShopCheckout.tsx` — PaymentMethod type + preferred method meesturen
3. `supabase/functions/create-checkout-session/index.ts` — preferred_payment_method respecteren
4. Storefront data hook — `stripe_payment_methods` meenemen

### Resultaat
- Klant ziet direct welke betaalmethode ze kiezen
- Stripe Checkout opent met precies die ene methode — geen verwarring
- Professionelere, duidelijkere checkout experience


## Fix voor de Stripe checkout error

### Waarschijnlijke oorzaak
- `supabase/functions/create-checkout-session/index.ts` bouwt `payment_method_types` nu op basis van `tenant.stripe_payment_methods`, maar controleert niet of die methodes ook echt actief zijn op het connected account.
- In `src/components/admin/settings/TransactionFeeSettings.tsx` kunnen oude/stale waarden in `stripe_payment_methods` blijven zitten, ook al zijn DE/AT-methodes al uit de UI gehaald.
- `supabase/functions/create-connect-account/index.ts` vraagt vandaag wel `card`, `ideal`/`bancontact` en `sepa` aan, maar niet betrouwbaar Klarna. Daardoor kan een tenant een methode kiezen die Stripe voor dat account niet effectief kan gebruiken.

### Plan
1. **Checkout backend hard maken**
   - In `supabase/functions/create-checkout-session/index.ts` eerst het connected account ophalen en de echte capabilities lezen.
   - `payment_method_types` daarna opbouwen als doorsnede van:
     - tenant-configuratie,
     - methodes die de app ondersteunt,
     - methodes die op het Stripe account effectief actief zijn.
   - Concreet mappen:
     - `card` → `card_payments`
     - `ideal` → `ideal_payments`
     - `bancontact` → `bancontact_payments`
     - `klarna` → alleen meenemen als die capability echt actief is
   - Als er niets geldig overblijft: geen checkout session maken, maar meteen een duidelijke fout teruggeven.

2. **Stale tenant-config opschonen**
   - In `src/components/admin/settings/TransactionFeeSettings.tsx` bij laden de opgeslagen `stripe_payment_methods` eerst normaliseren naar alleen nog geldige zichtbare codes.
   - Bij opslaan dezelfde sanitizing opnieuw toepassen, zodat oude waarden zoals `eps`, `giropay` en `sofort` definitief verdwijnen.
   - Als na opschoning niets overblijft: fallback naar een veilige default, bv. minimaal `card`.

3. **Klarna veilig behandelen**
   - Klarna niet meer “blind” als bruikbare methode beschouwen.
   - Ofwel alleen tonen/selecteerbaar maken wanneer die capability actief is, of tijdelijk verbergen/disablen tot de connect-flow die methode correct ondersteunt.
   - Zo kan een merchant zichzelf niet opnieuw in een kapotte checkout configureren.

4. **Betere foutmelding in storefront**
   - In `src/pages/storefront/ShopCheckout.tsx` de backendfout netjes tonen wanneer er geen geldige Stripe methodes beschikbaar zijn.
   - Dan strandt de gebruiker niet meer op een kapotte Stripe pagina, maar ziet meteen wat er mis is.

### Technische details
- Bestanden:
  - `supabase/functions/create-checkout-session/index.ts`
  - `src/components/admin/settings/TransactionFeeSettings.tsx`
  - eventueel `src/pages/storefront/ShopCheckout.tsx`
- Geen database-migratie nodig.
- De belangrijkste fix zit in de backend: daarmee stopt de Stripe-fout ook voor tenants met oude kapotte data.

### Verwacht resultaat
- Stripe Checkout krijgt alleen nog geldige `payment_method_types`.
- Oude methodes die nog in de database hangen, breken de checkout niet meer.
- Klarna kan geen “There are no valid payment methods available” meer veroorzaken.
- De merchant krijgt een duidelijke melding of veilige fallback in plaats van een foutpagina bij Stripe.

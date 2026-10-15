# Promotiemotor-vergelijkingstest (PROMO-ENGINE-1)

Vergelijkt de kortingsberekening van een oude versie van `storefront-api` met de huidige,
op echte data uit de live-databank. Gebruik dit bij elke wijziging aan
`supabase/functions/_shared/promotionEngine.ts` of aan de kortingslogica in de API:
"eigen frontends merken niks" is pas bewezen als deze test het zegt.

Wat hij test, per scenario (alle echte carts + ~3.500 synthetische carts per winkel:
productmixen × codes × klant met/zonder eerdere bestelling × verzendmethode):

- **cart_get**: het volledige `computeCartTotals`-resultaat moet identiek zijn.
- **checkout**: de korting die de klant betaalt, oud vs. nieuw, via dezelfde route als de
  echte checkout (`refreshCartDiscount` → `computeCartPromotions` met `promoValidator`).
  Verschillen worden per winkel en soort korting geteld, zodat je ziet of ze bedoeld zijn.

  Exporteert de oude versie `promoValidator` en `computeCartPromotions` (elke versie sinds
  PROMO-ENGINE-1), dan rekent de oude kant met de óude validator en de óude motor. Een
  controlerun HEAD↔HEAD geeft dan 0 verschillen. Alleen bij een oude versie van vóór de
  motor (zoals 747a79a) valt de checkout-kolom terug op de toenmalige lus per code
  (elke geldige code apart op het subtotaal). Het script meldt bovenaan welke modus loopt.

## Draaien

1. Fixture ophalen via de Lovable-connector (`query_database` op het SellQo-project) met
   `fixture.sql`, en het `fixture`-veld als `fixture.json` naast dit script bewaren. E-mails
   zitten er alleen als md5 in. `fixture.json` staat in `.gitignore`: nooit committen.
2. De oude versie ophalen en beide versies tijdelijk exporteerbaar maken:

   ```sh
   F=supabase/functions
   git show <oude-commit>:$F/storefront-api/index.ts > $F/storefront-api/__cmp_legacy.ts
   # oude versie mét motor (sinds PROMO-ENGINE-1):
   echo 'export { computeCartTotals, validateDiscountCode, calculateDiscountValue, promoValidator, computeCartPromotions };' >> $F/storefront-api/__cmp_legacy.ts
   # oude versie van vóór de motor (747a79a en ouder): zonder de laatste twee
   cp $F/storefront-api/index.ts $F/storefront-api/__cmp_new.ts
   echo 'export { computeCartTotals, validateDiscountCode, promoValidator, computeCartPromotions };' >> $F/storefront-api/__cmp_new.ts
   ```

3. Draaien met `import_map.stubs.json`, die de remote imports naar `stubs/` laat wijzen
   (de sandbox bereikt deno.land/esm.sh niet):

   ```sh
   cd scripts/promo-compare
   DENO_NO_PACKAGE_JSON=1 deno run --allow-read --allow-env --no-lock --node-modules-dir=none \
     --import-map=import_map.stubs.json compare.ts "$(pwd)/../../supabase/functions" [pad/naar/fixture.json]
   rm ../../supabase/functions/storefront-api/__cmp_*.ts
   ```

   Zonder tweede argument leest het script `fixture.json` naast zichzelf.

Uitkomst op 13-10-2026 (747a79a → PROMO-ENGINE-1): 3.619 scenario's, cart_get 100%
identiek; checkout identiek behalve Loveke "Loveke for Two" (staffelkorting werd vroeger
niet aangerekend, nu wel), zoals bedoeld.

**Correctie (RESTJES-1, 15-10-2026).** Tot RESTJES-1 vergeleek de checkout-kolom áltijd
met de lus van vóór de motor, ook als de oude versie al de motor had. Bij DISCOUNT-LIMIT-1
gaf HEAD↔HEAD daardoor al 451 verschillen (Loveke-staffel, Fonske code+code): ruis van
het harnas, geen regressie. Na de aanpassing geeft HEAD↔HEAD op een synthetische fixture
(staffel + twee stapelbare codes, 397 scenario's) 0 verschillen; dezelfde fixture in de
oude lus-modus geeft 180. Een run op een verse live-fixture staat nog open.

## `deno check` zonder netwerk

Dezelfde `import_map.stubs.json` werkt ook voor `deno check` op losse functies:

```sh
DENO_NO_PACKAGE_JSON=1 deno check --no-lock --node-modules-dir=none \
  --import-map=scripts/promo-compare/import_map.stubs.json supabase/functions/stripe-connect-webhook/index.ts
```

`stubs/stripe.ts` declareert de `Stripe`-namespace (`Stripe.Event`, `Stripe.Checkout.Session`, …)
met `any`-types. Gebruikt een functie een Stripe-type dat er nog niet in staat, dan faalt
de check met TS2503/TS2694: voeg het type daar toe. Een remote import met een versie die nog
niet in de map staat, voeg je aan de map toe.

## Rooktest (`smoke.ts`)

Roept `getProducts`, `getProductFilters` en `computeCartTotals` uit de echte
`storefront-api/index.ts` aan tegen de thenable nep-databank. Draait in CI. Hij vangt
fouten die `deno check` mist, zoals een `await` op een querybuilder (R10 in
sellqo-engineering-rules, incident CATALOG-FILTERS-1). Hoe je hem draait, staat bovenaan
`smoke.ts`. Na een wijziging in de API-functies die de rooktest aanroept, breid je de
tests mee uit.

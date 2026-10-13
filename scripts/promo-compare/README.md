# Promotiemotor-vergelijkingstest (PROMO-ENGINE-1)

Vergelijkt de kortingsberekening van een oude versie van `storefront-api` met de huidige,
op echte data uit de live-databank. Gebruik dit bij elke wijziging aan
`supabase/functions/_shared/promotionEngine.ts` of aan de kortingslogica in de API:
"eigen frontends merken niks" is pas bewezen als deze test het zegt.

Wat hij test, per scenario (alle echte carts + ~3.500 synthetische carts per winkel:
productmixen × codes × klant met/zonder eerdere bestelling × verzendmethode):

- **cart_get**: het volledige `computeCartTotals`-resultaat moet identiek zijn.
- **checkout**: de korting die de klant betaalt, oud vs. nieuw. Verschillen worden per
  winkel en soort korting geteld, zodat je ziet of ze bedoeld zijn.

## Draaien

1. Fixture ophalen via de Lovable-connector (`query_database` op het SellQo-project) met
   `fixture.sql`, en het `fixture`-veld als `fixture.json` naast dit script bewaren. E-mails
   zitten er alleen als md5 in. `fixture.json` staat in `.gitignore`: nooit committen.
2. De oude versie ophalen en beide versies tijdelijk exporteerbaar maken:

   ```sh
   F=supabase/functions
   git show <oude-commit>:$F/storefront-api/index.ts > $F/storefront-api/__cmp_legacy.ts
   echo 'export { computeCartTotals, validateDiscountCode, calculateDiscountValue };' >> $F/storefront-api/__cmp_legacy.ts
   cp $F/storefront-api/index.ts $F/storefront-api/__cmp_new.ts
   echo 'export { computeCartTotals, validateDiscountCode, promoValidator };' >> $F/storefront-api/__cmp_new.ts
   ```

3. Een import map maken die de remote imports naar `stubs/` laat wijzen (de sandbox
   bereikt deno.land/esm.sh niet), en draaien:

   ```sh
   cd scripts/promo-compare
   deno run --allow-read --import-map=import_map.json compare.ts "$(pwd)/../../supabase/functions"
   rm ../../supabase/functions/storefront-api/__cmp_*.ts
   ```

   `import_map.json` mapt `https://deno.land/std@0.190.0/http/server.ts`,
   `https://esm.sh/@supabase/supabase-js@2`, `…@2.57.2`, `https://esm.sh/resend@2.0.0` en
   `https://esm.sh/stripe@14.21.0` naar de bestanden in `stubs/` (absolute paden).

Uitkomst op 13-10-2026 (747a79a → PROMO-ENGINE-1): 3.619 scenario's, cart_get 100%
identiek; checkout identiek behalve Loveke "Loveke for Two" (staffelkorting werd vroeger
niet aangerekend, nu wel), zoals bedoeld.

## Rooktest (`smoke.ts`)

Roept `getProducts`, `getProductFilters` en `computeCartTotals` uit de echte
`storefront-api/index.ts` aan tegen de thenable nep-databank. Draait in CI. Hij vangt
fouten die `deno check` mist, zoals een `await` op een querybuilder (R10 in
sellqo-engineering-rules, incident CATALOG-FILTERS-1). Hoe je hem draait, staat bovenaan
`smoke.ts`. Na een wijziging in de API-functies die de rooktest aanroept, breid je de
tests mee uit.

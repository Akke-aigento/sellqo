# SHIP-GEO-2 — Landenlijst overal dynamisch per tenant

De SellQo-checkout (`ShopCheckout.tsx`) haalt de landen al op via `get_shipping_countries` en filtert de dropdown. Wat nog ontbreekt, zijn de overige plekken en de headless frontends.

## Wat er nog moet gebeuren

1. **Verouderde checkout-component opruimen**
   `src/components/storefront/CheckoutForm.tsx` heeft nog een eigen hardcoded EU/non-EU landenlijst (incl. US, GB, CH, NO) en eigen btw-logica. De component wordt nergens geïmporteerd. Verwijderen, zodat er geen tweede bron van waarheid meer bestaat.

2. **Landkeuze robuust maken in de checkout**
   - Als het gekozen/voorgevulde land (standaard het tenantland) niet in de verzendlijst zit: automatisch naar het eerste toegestane land springen, zodat de klant nooit met een niet-leverbaar land verder gaat.
   - Bij precies één toegestaan land: veld tonen als vast label i.p.v. dropdown.
   - Lege lijst (geen enkele verzendmethode dekt een land): duidelijke melding "Deze winkel verzendt momenteel niet" i.p.v. een leeg dropdownmenu.

3. **Landnamen meertalig**
   `src/lib/shippingRegions.ts` bevat alleen Nederlandse namen. De storefront-dropdown gaat de namen tonen via `Intl.DisplayNames` in de actieve storefront-taal, met de bestaande Nederlandse naam als fallback. Sortering volgt de actieve taal.

4. **Headless frontends bedienen**
   `get_shipping_countries` teruggeven met meer context zodat externe frontends geen eigen lijst hoeven te onderhouden: naast `countries` ook het standaardland van de winkel en of de lijst onbeperkt is. Response blijft backwards compatible (bestaande velden ongewijzigd).

5. **Documentatie & release**
   - Headless docs/prompt library: sectie "landkeuze in de checkout" met het aanbevolen patroon (lijst ophalen, dropdown vullen, ongeldig land resetten).
   - Changelog-entry (4 talen) in de bestaande stijl.

## Technisch

- Verwijderen: `src/components/storefront/CheckoutForm.tsx`.
- Wijzigen: `src/pages/storefront/ShopCheckout.tsx` (auto-correctie land, single-country modus, lege-lijst state, gelokaliseerde namen), `src/lib/shippingRegions.ts` (helper `localizedCountryName(code, locale)`).
- Wijzigen: `supabase/functions/storefront-api/index.ts` — `getShippingCountries` breidt uit met `default_country` (tenantland indien toegestaan) naast `countries`/`unrestricted`; caching (`max-age=300`) blijft.
- Geen databasemigratie nodig; `shipping_methods.countries` en `tenants.shipping_allowed_countries` bestaan al.

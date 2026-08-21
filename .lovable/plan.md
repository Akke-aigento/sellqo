# VOLUME-CART-1 — Staffelkorting in de cart/checkout-berekening

## Probleem

Staffelkortingen (`volume_discounts`) bestaan in de admin en in `calculatePromotions`, maar die actie wordt nergens in de cart-flow aangeroepen. `computeCartTotals` — de enige rekenfunctie achter `cart_get` en de checkout-keten — kent alleen kortingscodes. Gevolg: een staffel heeft nul effect op wat de klant betaalt.

Daarnaast schrijft de admin-kant `applies_to` weg als `product` / `category`, terwijl de DB CHECK-constraint `specific_products` / `specific_categories` eist — opslaan van een staffel op specifieke producten of categorieën faalt dus.

## Wat er gebouwd wordt

### 1. Volumekorting in `computeCartTotals` (`supabase/functions/storefront-api/index.ts`)

Nieuw blok direct vóór de bestaande discount-code-loop, zodat codes stapelen op de al volume-gereduceerde grondslag:

- Actieve staffels laden: `volume_discounts` + `volume_discount_tiers`, gefilterd op `tenant_id` en `is_active`.
- Per staffel: overslaan als `isPromotionActive(true, valid_from, valid_until)` false is.
- `eligibleItems` bepalen:
  - `all` → alle cartitems.
  - `specific_products` en legacy `product` → items met `product_id` in `product_ids`.
  - `specific_categories` en legacy `category` → categorie-lidmaatschap via een `product_categories`-query op `product_id IN (...)` en `category_id IN (...)`, exact hetzelfde patroon als de categorie-tak in de discount-code-loop. Cartitems hebben géén `category_id`; daar wordt niet op geleund.
- `qty` = som van `quantity`; tier = hoogste `min_quantity` die past (`qty >= min_quantity && (!max_quantity || qty <= max_quantity)`).
- `base` = som van `line_total` van de eligible items; `amt = round2(calculateDiscountValue(base, tier.discount_type, tier.discount_value))`.
- Bij `amt > 0`: optellen bij `discountTotal` en pushen als `{ code: null, description: vd.name || 'Staffelkorting', amount: amt, type: 'volume' }`.
- Het `appliedDiscounts`-type wordt verbreed naar `code: string | null` en optionele `type`.
- `discount_codes: appliedDiscounts.map(d => d.code)` krijgt een `.filter(Boolean)`, zodat er nooit een `null` in de codes-array van de response belandt.
- `discountTotal = Math.min(discountTotal, subtotal)` blijft de eindclamp; volume telt daar gewoon in mee.

Bestaande code- en verzendlogica wordt niet aangeraakt. Zonder actieve, matchende staffel doet het blok niets en blijft de response byte-identiek.

### 2. Enum-inconsistentie admin-kant rechttrekken

- `src/types/promotions.ts`: `VolumeDiscount.applies_to` en `VolumeDiscountFormData.applies_to` → `'all' | 'specific_products' | 'specific_categories'`.
- `src/components/admin/promotions/VolumeDiscountFormDialog.tsx`: zod-enum en `<SelectItem value=...>` naar de nieuwe waarden (labels ongewijzigd Nederlands).
- `src/hooks/useVolumeDiscounts.ts`: mapping meebewegen waar nodig.
- `src/pages/admin/VolumeDiscounts.tsx`: labelmap uitbreiden met de nieuwe keys (legacy keys blijven staan voor oude data).
- Geen migratie, geen datawijziging: bestaande `all`-records blijven geldig.

## Gedeeld pad

`computeCartTotals` bedient `cart_get` en de hele checkout-keten voor álle tenants, inclusief de vijf custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata). De wijziging is strikt additief: geen bestaande sleutel verdwijnt of verandert van betekenis, `calculatePromotions` blijft ongemoeid, de discount-code-logica blijft ongewijzigd. De enige nieuwe sleutel op items in `applied_discounts` is `type`; `code` kan nu `null` zijn, maar uitsluitend voor volume-regels, en de codes-array blijft vrij van nulls.

## Verificatie (verplicht vóór "klaar")

1. Loveke-cart (tenant `1671a91c-31fe-42ed-8a10-41f3117ceb50`) met 2× een product → `discount_amount` = 7% van subtotaal en `applied_discounts` bevat "Loveke for Two".
2. Loveke-cart met 1× product → geen volumekorting, totalen ongewijzigd.
3. Cart bij een tenant zonder volumekorting → totalen exact identiek aan de huidige situatie (voor/na vergelijken).
4. `npx tsc --noEmit -p tsconfig.app.json` schoon (in achtergrond, exit code uit logbestand).
5. Testcarts na de test opruimen.

## Slottaken

- Role-audit-entry `VOLUME-CART-1` in `docs/role-audit.md` (root cause, uitgevoerd, security, gedeelde-paden-waarschuwing, verificatie).
- Publieke changelog: nieuwe entry in `src/pages/public/PublicChangelog.tsx` + `public.changelog.changes.<id>` in `landing.<code>.json` voor elke taal uit `SUPPORTED_LANGUAGES`; `scripts/i18n-parity.mjs` moet groen zijn.
- `doc_articles`-artikel over staffelkortingen bijwerken/toevoegen (`context_path` = de promoties-route).
- Item onder **Openstaand** in `docs/newsletter-queue.md`.

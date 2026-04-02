

## Fix: Shopify Varianten & Afbeeldingen Import

### Gevonden problemen

1. **Kolom naam mismatch**: De edge function schrijft `sort_order` naar `product_variant_options`, maar de tabel heeft `position` als kolomnaam → insert faalt silently → geen variant options, geen varianten
2. **"Default Title" niet gefilterd**: Producten zonder echte varianten hebben `Option1 Value = "Default Title"` — deze worden nu ook als variant aangemaakt
3. **`featured_image` niet gezet**: De eerste afbeelding wordt niet als `featured_image` ingesteld op het product

### Wijzigingen

**1. `supabase/functions/run-csv-import/index.ts`** — `importProductVariants` functie

- **Fix kolom naam**: `sort_order` → `position` in de `product_variant_options` insert (lijn 547)
- **Filter "Default Title"**: Skip variant-aanmaak wanneer er slechts 1 variant is met option1 = "Default Title"
- **Betere error logging**: `console.error` bij variant insert failures zodat we kunnen debuggen

**2. `src/lib/importMappings.ts`** — `consolidateShopifyProductRows`

- **Filter "Default Title" varianten**: Als alle varianten `option1 = "Default Title"` hebben, zet `_variants_json` niet (geen echte varianten)
- **`featured_image` uit eerste `Image Src`**: Zet `mainRow['Variant Image']` naar de eerste image als fallback voor featured_image

**3. `supabase/functions/run-csv-import/index.ts`** — `buildProductData`

- Zet `featured_image` naar eerste image uit `images` array als `featured_image` niet expliciet gezet is

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/run-csv-import/index.ts` | Fix `sort_order` → `position`, filter Default Title, betere logging |
| `src/lib/importMappings.ts` | Filter Default Title varianten, featured_image fallback |

### Geen database wijzigingen nodig


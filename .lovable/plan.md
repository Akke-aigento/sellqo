

## Kleding-metafields naar juiste tabellen mappen (niet raw_import_data)

### Probleem

Alle 27 kleding-metafields (Size, Color, Fabric, Fit, Target gender, etc.) worden nu naar `raw_import_data` JSONB gedumpt. Er is echter al een `product_specifications` tabel met kolommen als `color`, `size`, `material`, `brand`, plus een `product_custom_specs` tabel voor overige attributen. De data belandt op de verkeerde plek.

### Aanpak

**1. `src/lib/importMappings.ts`** — Mapping targets wijzigen

Velden die direct naar `product_specifications` kolommen passen:

| Shopify metafield | Nieuw target | Was |
|---|---|---|
| Color | `spec:color` | raw_import_data |
| Size | `spec:size` | raw_import_data |
| Fabric | `spec:material` | raw_import_data |
| Material | `spec:material` | raw_import_data |
| Care instructions | `spec:storage_instructions` | raw_import_data |
| Variant Image | `images` (append) | raw_import_data |

Overige kleding-metafields → `custom_spec:Kleding:{key}` (nieuw transform type):

| Metafield | custom_spec key |
|---|---|
| Fit | fit |
| Target gender | target_gender |
| Neckline | neckline |
| Sleeve length type | sleeve_length |
| Pants length type | pants_length |
| Waist rise | waist_rise |
| Closure type | closure_type |
| Shoe fit | shoe_fit |
| Shoe features | shoe_features |
| Sneaker style | sneaker_style |
| Toe style | toe_style |
| Activewear features | activewear_features |
| etc. | etc. |

**2. `src/lib/importMappings.ts`** — Nieuwe transformer toevoegen

- `spec` transformer: markeert veld als `_spec_{column}` in het transformed record
- `customSpec` transformer: markeert als `_custom_spec_{group}_{key}`

**3. `supabase/functions/run-csv-import/index.ts`** — Na product insert/update

Na het product aanmaken, extract `_spec_*` en `_custom_spec_*` velden uit de record:

```text
1. Verzamel alle _spec_ velden → upsert naar product_specifications
2. Verzamel alle _custom_spec_ velden → upsert naar product_custom_specs
```

**4. `src/types/import.ts`** — Target fields uitbreiden

Voeg `spec:color`, `spec:size`, `spec:material`, `custom_spec:*` toe aan `PRODUCT_TARGET_FIELDS` zodat ze in de dropdown verschijnen met leesbare namen.

### Resultaat

- Color → `product_specifications.color`
- Size → `product_specifications.size`
- Fabric → `product_specifications.material`
- Fit, Neckline, Gender, etc. → `product_custom_specs` met groep "Kleding"
- Variant Image → toegevoegd aan `products.images` array
- Data is doorzoekbaar en toonbaar op productpagina's


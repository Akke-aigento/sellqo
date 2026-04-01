

## Shopify Kledingwinkel Metafields Toevoegen aan Import Mapping

### Probleem

De Shopify product export van deze kledingwinkel bevat 27 kleding-specifieke metafields (maat, kleur, stof, pasvorm, etc.) die niet in de huidige `SHOPIFY_PRODUCT_MAPPING` staan. Hierdoor worden deze velden overgeslagen bij import. De bestaande mapping bevat alleen elektronica-gerelateerde metafields.

### Ontbrekende velden uit de CSV

| Veld | Mapping key |
|---|---|
| Accessory size | `accessory_size` |
| Activewear clothing features | `activewear_features` |
| Activity | `activity` |
| Age group | `age_group` |
| Bag/Case features | `bag_case_features` |
| Bag/Case material | `bag_case_material` |
| Bag/Case storage features | `bag_case_storage` |
| Care instructions | `care_instructions` |
| Carry options | `carry_options` |
| Closure type | `closure_type` |
| Clothing accessory material | `clothing_accessory_material` |
| Clothing features | `clothing_features` |
| Fabric | `fabric` |
| Fit | `fit` |
| Footwear material | `footwear_material` |
| Headwear features | `headwear_features` |
| Neckline | `neckline` |
| Outerwear clothing features | `outerwear_features` |
| Pants length type | `pants_length` |
| Shoe features | `shoe_features` |
| Shoe fit | `shoe_fit` |
| Size | `size` |
| Sleeve length type | `sleeve_length` |
| Sneaker style | `sneaker_style` |
| Target gender | `target_gender` |
| Toe style | `toe_style` |
| Top length type | `top_length` |
| Waist rise | `waist_rise` |

**NB:** `Color (product.metafields.shopify.color-pattern)` staat al in de mapping.

### Wijziging

**`src/lib/importMappings.ts`** — Voeg alle 27 kleding-metafields toe aan `SHOPIFY_PRODUCT_MAPPING`, elk als `raw_import_data` met `jsonString:key` transform. Gegroepeerd als "Clothing & Fashion metafields" sectie na de bestaande electronics metafields.

### Geen database wijzigingen nodig
Alle metafields gaan naar het bestaande `raw_import_data` JSONB veld — dat is precies waarvoor het ontworpen is.


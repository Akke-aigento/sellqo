

## Varianten importeren vanuit Shopify CSV

### Probleem

De consolidatie-functie verzamelt al variant-data in `_variants_json`, maar:
1. De **eerste rij** (met Title) wordt overgeslagen als variant — terwijl dit ook een variant is
2. De **edge function** negeert `_variants_json` volledig — er worden geen `product_variants` of `product_variant_options` aangemaakt

### Wijzigingen

**1. `src/lib/importMappings.ts`** — `consolidateShopifyProductRows` fixen

- De eerste rij (met Title + Option1 Value) ook als variant opnemen in `variantsMap`
- Option namen meegeven: `option1_name`, `option2_name`, `option3_name` uit de hoofdrij
- Variant Image meenemen per variant
- Compare At Price meenemen per variant

```text
// Huidige check (lijn 751): row['Option1 Value'] && !row['Title']?.trim()
// Nieuwe check: row['Option1 Value'] (alle rijen met option values, inclusief eerste)
```

**2. `supabase/functions/run-csv-import/index.ts`** — Variant-verwerking toevoegen

Na product insert/update, als `_variants_json` aanwezig:

```text
Stap 1: Parse _variants_json → array van variant objecten
Stap 2: Lees option namen uit record (option1_name, option2_name, option3_name)
Stap 3: Maak/update product_variant_options
   - Per option naam: verzamel unieke waarden uit alle varianten
   - Upsert in product_variant_options (product_id, name, values[])
Stap 4: Maak/update product_variants  
   - Per variant: upsert op (product_id, tenant_id, SKU) of (product_id, attribute_values)
   - title = option values samengevoegd met " / "
   - attribute_values = { [option1_name]: option1_value, ... }
   - price, stock, sku, barcode, image_url uit variant data
```

**3. `src/lib/importMappings.ts`** — Mapping aanpassen

- `_variants_json` als intern veld doorgeven (geen target nodig, wordt direct in record meegegeven)
- Option namen (`Option1 Name` etc.) opslaan als `_option1_name` etc. in het geconsolideerde record zodat de edge function ze kan lezen

### Voorbeeld flow

```text
Shopify CSV:
  Handle: "basic-tshirt"
  Option1 Name: "Size"    Option2 Name: "Color"
  Row 1: Title="Basic T-Shirt", Option1="S", Option2="Red", SKU="BT-S-R", Price=29.99
  Row 2: (no title),            Option1="M", Option2="Red", SKU="BT-M-R", Price=29.99
  Row 3: (no title),            Option1="L", Option2="Blue", SKU="BT-L-B", Price=34.99

→ product_variant_options:
  { name: "Size",  values: ["S", "M", "L"] }
  { name: "Color", values: ["Red", "Blue"] }

→ product_variants:
  { title: "S / Red",   sku: "BT-S-R", price: 29.99, attribute_values: {Size: "S", Color: "Red"} }
  { title: "M / Red",   sku: "BT-M-R", price: 29.99, attribute_values: {Size: "M", Color: "Red"} }
  { title: "L / Blue",  sku: "BT-L-B", price: 34.99, attribute_values: {Size: "L", Color: "Blue"} }
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/lib/importMappings.ts` | Consolidatie: eerste rij als variant + option namen + meer variant velden |
| `supabase/functions/run-csv-import/index.ts` | Nieuwe `importProductVariants()` functie na product upsert |

### Geen database wijzigingen nodig
De `product_variants` en `product_variant_options` tabellen bestaan al met alle benodigde kolommen.


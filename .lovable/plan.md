

## Auto-link categorieën bij Shopify product import

### Probleem

De `run-csv-import` edge function slaat `original_category_value`, `google_product_category`, `category_id` en andere categorie-gerelateerde velden niet op. Er is ook geen logica om producten automatisch aan categorieën te koppelen via de `product_categories` junction tabel.

### Wijzigingen

**1. `supabase/functions/run-csv-import/index.ts`** — 2 aanpassingen

**buildProductData** — Voeg ontbrekende velden toe:
- `original_category_value`, `google_product_category`, `shopify_product_id`, `shopify_handle`, `vendor`, `import_source`
- Alle velden die al in de mapping staan maar nu weggegooid worden

**importProducts** — Na product insert/update, categorie-linking toevoegen:
```
Voor elk product:
1. Lees original_category_value (= Shopify "Type") en/of google_product_category
2. Als original_category_value aanwezig:
   a. Zoek bestaande categorie op naam (case-insensitive) voor deze tenant
   b. Niet gevonden → maak nieuwe categorie aan (naam + auto-slug)
   c. Upsert in product_categories (product_id, category_id)
3. Cache categorie lookups in een Map om dezelfde categorie niet 100x op te zoeken
```

**2. `src/lib/importMappings.ts`** — Controleren dat `Type` → `original_category_value` en `Product Category` → `google_product_category` correct zijn (al het geval, geen wijziging nodig)

### Categorie-matching logica (in edge function)

```text
CSV "Type" waarde (bv. "T-Shirts")
       ↓
Zoek in categories WHERE tenant_id = X AND LOWER(name) = LOWER("T-Shirts")
       ↓
  Gevonden? → gebruik category_id
  Niet gevonden? → INSERT category (name, slug, tenant_id) → gebruik nieuwe id
       ↓
UPSERT product_categories (product_id, category_id)
  ON CONFLICT (product_id, category_id) DO NOTHING
```

### Resultaat
- Producten krijgen automatisch `original_category_value` opgeslagen
- Categorieën worden automatisch aangemaakt als ze niet bestaan
- Producten worden gelinkt aan categorieën via junction tabel
- Bij update van bestaand product worden categorie-links bijgewerkt


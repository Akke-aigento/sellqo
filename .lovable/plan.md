

## Multi-categorie koppeling voor producten

### Huidige situatie
Producten hebben een enkel `category_id` veld (uuid) dat verwijst naar 1 categorie. Dit beperkt de flexibiliteit: een product kan niet tegelijk in "Winterjassen" EN "Speciale actie" staan.

### Aanpak

We maken een many-to-many koppeltabel `product_categories` aan. Het bestaande `category_id` veld blijft bestaan als "hoofdcategorie" voor backward compatibility, maar producten kunnen nu ook extra categorieën krijgen.

### Stap 1: Database migratie

Nieuwe tabel `product_categories`:

```text
product_categories
  - id (uuid, PK)
  - product_id (uuid, FK -> products)
  - category_id (uuid, FK -> categories)
  - is_primary (boolean, default false)
  - sort_order (integer, default 0)
  - created_at (timestamptz)
  UNIQUE(product_id, category_id)
```

Migratie vult de tabel met bestaande `category_id` koppelingen (als `is_primary = true`). RLS policies voor tenant-isolatie.

### Stap 2: Product formulier aanpassen

**Bestand: `src/pages/admin/ProductForm.tsx`**
- Het huidige "Categorie" dropdown-veld vervangen door een multi-select component
- De eerste geselecteerde categorie wordt automatisch de primaire
- Gebruiker kan de primaire categorie markeren

### Stap 3: Hooks aanpassen

**Bestand: `src/hooks/usePublicStorefront.ts`**
- `usePublicProducts`: Bij filteren op categorie, query via `product_categories` tabel in plaats van `products.category_id`
- `usePublicProduct`: Alle categorieën van een product ophalen

**Bestand: `src/types/product.ts`**
- `Product` interface uitbreiden met `categories?: Category[]` (meervoud)
- `ProductFormData`: `category_id` vervangen door `category_ids: string[]`

### Stap 4: Storefront & filters aanpassen

**Bestand: `src/pages/admin/Products.tsx`**
- Categorie-filter werkt via `product_categories` tabel
- Bulk edit: meerdere categorieën toewijzen

**Bestand: `src/components/storefront/sections/CollectionSection.tsx`**
- Producten ophalen via `product_categories` koppeltabel

### Stap 5: Bulk operaties

**Bestand: `src/components/admin/products/bulk/BulkBasicTab.tsx`**
- Categorie bulk-edit aanpassen voor multi-select (toevoegen/verwijderen van categorieën)

### Technische details

Database query voorbeeld (storefront):
```text
-- Producten in categorie "Speciale actie"
SELECT p.* FROM products p
INNER JOIN product_categories pc ON pc.product_id = p.id
WHERE pc.category_id = 'actie-uuid'
AND p.is_active = true
AND p.hide_from_storefront = false
```

Backward compatibility:
- `products.category_id` blijft bestaan als snelle referentie naar de primaire categorie
- Een trigger synchroniseert `products.category_id` met de `is_primary = true` rij in `product_categories`
- Bestaande code die `category_id` leest blijft werken

### Resultaat
- Producten kunnen aan onbeperkt aantal categorieën gekoppeld worden
- "Speciale actie", "Nieuw", "Uitgelicht" etc. werken als echte categorieën
- Storefront filtert correct op alle gekoppelde categorieën
- Bestaande data wordt automatisch gemigreerd


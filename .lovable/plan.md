

## Fix: Storefront API filtert alleen op primaire categorie

### Probleem
De `storefront-api` edge function gebruikt overal alleen `category_id` (legacy/primair). De `product_categories` junction-tabel wordt **nergens** gecheckt. Daarom toont "Bestsellers" 0 producten, terwijl er 4 producten via de junction-tabel gekoppeld zijn.

Drie plekken in `supabase/functions/storefront-api/index.ts` moeten gefixt worden:

### Wijzigingen

**1. `getCategories()` — product_count (regel 245-257)**

Nu: telt alleen producten via `category_id`.
Fix: ook `product_categories` junction-tabel queryen en de counts combineren.

```typescript
// Huidige aanpak: alleen legacy category_id
const { data: productCounts } = await supabase
  .from('products').select('category_id')...

// Fix: OOK junction-tabel ophalen
const { data: junctionCounts } = await supabase
  .from('product_categories').select('category_id, products!inner(is_active, hide_from_storefront, tenant_id)')
  .eq('products.tenant_id', tenantId)
  .eq('products.is_active', true)
  .eq('products.hide_from_storefront', false);
// Merge beide counts (unieke product_ids per categorie)
```

**2. `getProducts()` — categorie filter (regel 502)**

Nu: `.eq('category_id', resolvedCategoryId)` — vindt alleen producten met die primaire categorie.
Fix: eerst product IDs ophalen uit junction-tabel, dan filteren op beide.

```typescript
if (resolvedCategoryId) {
  // Haal product IDs op uit junction-tabel
  const { data: junctionProducts } = await supabase
    .from('product_categories')
    .select('product_id')
    .eq('category_id', resolvedCategoryId);
  
  const junctionIds = junctionProducts?.map(jp => jp.product_id) || [];
  
  // Filter: legacy category_id OF in junction-tabel
  if (junctionIds.length > 0) {
    query = query.or(`category_id.eq.${resolvedCategoryId},id.in.(${junctionIds.join(',')})`);
  } else {
    query = query.eq('category_id', resolvedCategoryId);
  }
}
```

**3. `getProduct()` — related products (regel 304-312)**

Nu: zoekt gerelateerde producten alleen via `category_id`.
Fix: ook junction-tabel checken voor de categorieën van het huidige product.

### Bestand

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Junction-tabel meenemen in product counts, categorie-filter, en related products |

### Geen migratie nodig
De junction-tabel `product_categories` en bijbehorende RLS-policies bestaan al.


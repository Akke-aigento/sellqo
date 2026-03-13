

## Bugfix: product_count in /collections telt alleen legacy category_id

### Root Cause

`getCategories` (line 247-259) telt producten per categorie door `products.category_id` te tellen. Producten die via de `product_categories` junction table gekoppeld zijn worden genegeerd → `product_count: 0`.

### Fix

In `supabase/functions/storefront-api/index.ts`, vervang de product count logica (regels 246-259) door:

1. **Haal junction-koppelingen op**: Query `product_categories` voor alle category_ids in de resultaten
2. **Haal actieve product IDs op**: Filter op `is_active = true` en `hide_from_storefront = false`
3. **Combineer legacy + junction**: Tel unieke producten per categorie uit beide bronnen

```typescript
// 1. Legacy counts (products.category_id)
const { data: legacyProducts } = await supabase
  .from('products')
  .select('id, category_id')
  .eq('tenant_id', tenantId)
  .eq('is_active', true)
  .eq('hide_from_storefront', false);

// 2. Junction table counts
const categoryIds = categories.map((c: any) => c.id);
const { data: junctionRows } = await supabase
  .from('product_categories')
  .select('product_id, category_id')
  .in('category_id', categoryIds);

// 3. Filter junction to only active products
const activeProductIds = new Set((legacyProducts || []).map((p: any) => p.id));

const countMap: Record<string, Set<string>> = {};
// Add legacy
for (const p of (legacyProducts || [])) {
  if (p.category_id) {
    if (!countMap[p.category_id]) countMap[p.category_id] = new Set();
    countMap[p.category_id].add(p.id);
  }
}
// Add junction (only if product is active)
for (const row of (junctionRows || [])) {
  if (activeProductIds.has(row.product_id)) {
    if (!countMap[row.category_id]) countMap[row.category_id] = new Set();
    countMap[row.category_id].add(row.product_id);
  }
}
```

Dan in de map (regel 273): `product_count: countMap[cat.id]?.size || 0`

### Bestanden
- `supabase/functions/storefront-api/index.ts` — `getCategories` functie, regels 246-273


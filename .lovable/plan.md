

## Bugfix: category_slug filter in storefront-api getProducts

### Root Cause

`getProducts` (line 479) filters via `.eq('category_id', resolvedCategoryId)` — the legacy single-category FK on the `products` table. Since the app now uses the `product_categories` junction table for multi-category associations, products linked only via that table are missed.

### Fix

In `supabase/functions/storefront-api/index.ts`, replace the direct `category_id` filter with a subquery approach:

1. **Resolve slug to ID** — keep existing logic (lines 464-470), works fine.

2. **Replace the filter** (line 479) — instead of `.eq('category_id', resolvedCategoryId)`, first fetch the product IDs from `product_categories` junction table, then filter with `.in('id', matchingProductIds)`. Also keep the legacy `category_id` as fallback (OR logic):

```typescript
if (resolvedCategoryId) {
  // Get product IDs from junction table
  const { data: pcRows } = await supabase
    .from('product_categories')
    .select('product_id')
    .eq('category_id', resolvedCategoryId);
  
  const junctionIds = (pcRows || []).map((r: any) => r.product_id);
  
  // Also include products with legacy category_id
  // Use .or() to match either junction table OR legacy FK
  if (junctionIds.length > 0) {
    query = query.or(`category_id.eq.${resolvedCategoryId},id.in.(${junctionIds.join(',')})`);
  } else {
    query = query.eq('category_id', resolvedCategoryId);
  }
}
```

3. **Deploy** the edge function.

### Files
- `supabase/functions/storefront-api/index.ts` — replace line 479 category filter with junction-table-aware query


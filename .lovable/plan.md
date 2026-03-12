

## Bug Analysis: Cart Stock Check Fails When Track Inventory is Disabled

I've identified the bug in the `storefront-api` Edge Function. The stock check logic in both `cartAddItem` and `cartUpdateItem` functions doesn't properly respect the `track_inventory` flag.

### The Problem

**In `cartAddItem` (lines 1132, 1142):**
- When a variant is provided, `stockSource` becomes the variant
- The check `stockSource.track_inventory` only checks the variant's setting
- It ignores the parent product's `track_inventory` setting
- So even if the product has tracking disabled, a variant with tracking enabled still triggers stock checks

**In `cartUpdateItem` (line 1167):**
- Only fetches the product's `track_inventory`, not the variant's
- Ignores variant-level tracking settings entirely

### The Fix

Both functions need to check: **If `track_inventory` is falsey on EITHER the product OR the variant, skip all stock checks.**

```typescript
// Correct logic:
const shouldTrackInventory = product.track_inventory !== false && 
                             (!variant || variant.track_inventory !== false);

if (shouldTrackInventory && stockSource.stock < quantity) {
  throw new Error('Insufficient stock');
}
```

### Files to Modify

1. **supabase/functions/storefront-api/index.ts**:
   - Fix `cartAddItem` function (around lines 1132, 1142)
   - Fix `cartUpdateItem` function (around line 1167)
   - Ensure both fetch the product first to check `product.track_inventory`
   - If variant exists, also check `variant.track_inventory`
   - Skip stock check if either is false/null

### Implementation Details

**cartAddItem changes:**
1. Always fetch product's `track_inventory` status first
2. If variant provided, also fetch variant's `track_inventory`
3. Calculate: `const skipStockCheck = !product.track_inventory || (variant && !variant.track_inventory)`
4. Only perform stock validation if `!skipStockCheck`

**cartUpdateItem changes:**
1. Fetch the cart item first to get `product_id` and `variant_id`
2. Fetch product (and variant if applicable) to check their `track_inventory`
3. Apply same skip logic as cartAddItem




## Fix: Product Variants System - End-to-End

### Problem
Variants are a "phantom feature" -- the admin UI for creating them exists and writes to the database correctly, but the data is never read back in the right places:

1. **`usePublicProduct`** (storefront) only queries the `products` table. It never fetches `product_variants` or `product_variant_options`, so `product.variants`, `product.options`, and `product.has_variants` are always `undefined`.
2. **`usePublicProducts`** (product listing) also never includes variant info, so `has_variants` is always false on product cards.
3. The storefront detail page (`ShopProductDetail.tsx`) has full variant UI code that references `product.variants` and `product.options` -- but these properties are never populated.

### Solution

**File 1: `src/hooks/usePublicStorefront.ts`**

Update `usePublicProduct` to also fetch variants and options after loading the product:

- After fetching the product, make two additional queries:
  - `product_variants` filtered by `product_id` and `is_active = true`, ordered by `position`
  - `product_variant_options` filtered by `product_id`, ordered by `position`
- Attach these as `variants` and `options` on the returned product object
- Compute `has_variants: variants.length > 0`

Update `usePublicProducts` to include a variant count indicator:

- After fetching products, do a single query on `product_variants` grouped by `product_id` (or a simpler approach: fetch variant counts for all product IDs)
- Set `has_variants: true` on products that have at least one active variant

**File 2: `src/hooks/usePublicStorefront.ts` -- types**

Add the variant-related fields (`variants`, `options`, `has_variants`) to the return type so TypeScript is satisfied.

### Technical Details

```text
usePublicProduct flow (current):
  products table --> return product

usePublicProduct flow (fixed):
  products table --> product_variants --> product_variant_options --> return enriched product
                     (where product_id = X)   (where product_id = X)
                     
  Enriched product includes:
    .variants = [{ id, title, sku, price, compare_at_price, stock, image_url, attribute_values, ... }]
    .options = [{ name, values }]
    .has_variants = true/false
```

Changes are isolated to `usePublicStorefront.ts`. The storefront components (`ShopProductDetail`, `VariantSelector`, `QuickViewModal`, `ProductCard`) already have complete variant handling code -- they just need the data.

### Scope
- 1 file changed: `src/hooks/usePublicStorefront.ts`
- No database changes needed (tables and RLS policies already exist and are permissive)
- No storefront component changes needed (variant UI is already fully built)


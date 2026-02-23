
## Fix: Onboarding Product Creation - Invalid Column `image_url`

### Problem
The onboarding flow crashes when creating a product because `useOnboarding.ts` (line 715) inserts into a column called `image_url` on the `products` table. This column does not exist. The products table uses:
- `images` (text array) for all product images
- `featured_image` (text) for the primary image

The error message confirms this: *"Could not find the 'image_url' column of 'products' in the schema cache"*

### Fix
One-line change in `src/hooks/useOnboarding.ts` (line 715):

Replace:
```
image_url: productImageUrl || null,
```

With:
```
images: productImageUrl ? [productImageUrl] : [],
featured_image: productImageUrl || null,
```

This maps the uploaded onboarding image to the correct columns: `images` as an array with one entry, and `featured_image` for the primary display image. It also needs `product_type: 'physical'` as a default since that column is required.

### Technical Details
- **File**: `src/hooks/useOnboarding.ts`, lines ~709-720
- **Root cause**: Column name mismatch (`image_url` vs `images`/`featured_image`)
- **Risk**: None -- straightforward column mapping fix
- **Also adding**: `product_type: 'physical'` as a sensible default for onboarding products, since the `product_type` column is required on the products table

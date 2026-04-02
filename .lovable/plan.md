

## Fix: Varianten worden niet geladen op de webshop productpagina

### Root Cause

`usePublicProduct` in `src/hooks/usePublicStorefront.ts` haalt het product rechtstreeks uit de `products` tabel, maar **fetcht nooit `product_variants` of `product_variant_options`**. Hierdoor zijn `has_variants`, `variants` en `options` altijd `undefined` op de storefront productpagina.

De storefront API edge function (`getProduct`) doet dit wél correct, maar `usePublicProduct` gebruikt die API niet.

### Oplossing

**`src/hooks/usePublicStorefront.ts`** — `usePublicProduct` uitbreiden

Na het fetchen van het product, ook varianten en opties ophalen:

```typescript
// Na product fetch, haal varianten en opties op
const [{ data: variants }, { data: variantOptions }] = await Promise.all([
  supabase.from('product_variants')
    .select('id, title, sku, barcode, price, compare_at_price, stock, track_inventory, image_url, attribute_values, weight, position, is_active, linked_product_id')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .order('position', { ascending: true }),
  supabase.from('product_variant_options')
    .select('id, name, values, position')
    .eq('product_id', product.id)
    .order('position', { ascending: true }),
]);

const hasVariants = (variants?.length || 0) > 0;
```

En in de return:

```typescript
return {
  ...product,
  has_variants: hasVariants,
  variants: (variants || []).map(v => ({
    ...v,
    in_stock: !v.track_inventory || (v.stock || 0) > 0,
    price: v.price ?? product.price,
    compare_at_price: v.compare_at_price ?? product.compare_at_price,
  })),
  options: variantOptions || [],
  in_stock: hasVariants 
    ? (variants || []).some(v => !v.track_inventory || (v.stock || 0) > 0) 
    : (!product.track_inventory || (product.stock || 0) > 0),
  // ... rest unchanged
};
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/usePublicStorefront.ts` | Varianten + opties fetchen in `usePublicProduct` |

### Geen database wijzigingen nodig


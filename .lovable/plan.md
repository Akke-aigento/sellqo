

## Fix: Bundel data niet gerenderd op custom frontend

### Root cause

De **storefront-api** edge function zoekt bundel-items in de **oude** tabellen (`product_bundles` → `bundle_products`), maar het ProductForm slaat bundel-items nu op in de **nieuwe** tabel `product_bundle_items` (met `product_id` → `child_product_id` structuur).

De API vindt dus nooit bundel-items, waardoor `bundle_items` leeg is in de response.

### Oplossing

**1. `storefront-api/index.ts` — bundel data ophalen uit `product_bundle_items`**

Vervang het hele bundel-blok (regels 433-478). In plaats van `product_bundles` + `bundle_products` te queryen, direct `product_bundle_items` ophalen op basis van het product ID:

```typescript
if (product.product_type === 'bundle') {
  const { data: bundleItems } = await supabase
    .from('product_bundle_items')
    .select('id, quantity, customer_can_adjust, min_quantity, max_quantity, sort_order, child_product_id, products!product_bundle_items_child_product_id_fkey(id, name, slug, price, images, track_inventory, stock)')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true });

  const items = (bundleItems || []).map(bi => ({
    id: bi.id,
    product_id: bi.child_product_id,
    quantity: bi.quantity,
    customer_can_adjust: bi.customer_can_adjust,
    min_quantity: bi.min_quantity,
    max_quantity: bi.max_quantity,
    sort_order: bi.sort_order,
    product: bi.products ? {
      id: bi.products.id,
      name: bi.products.name,
      slug: bi.products.slug,
      price: bi.products.price,
      image: bi.products.images?.[0] || null,
      in_stock: !bi.products.track_inventory || bi.products.stock > 0,
    } : null,
  }));

  const individualTotal = items.reduce((s, bi) => s + (bi.product?.price || 0) * bi.quantity, 0);

  bundleData = {
    bundle_items: items,
    bundle_individual_total: individualTotal,
    bundle_savings: individualTotal > product.price ? individualTotal - product.price : 0,
    bundle_pricing_model: product.bundle_pricing_model || 'fixed',
  };
}
```

**2. Prompt voor custom frontend project**

Na de API-fix genereer ik een kant-en-klare prompt met:
- De exacte API response structuur voor bundels
- Component-logica: productenlijst met afbeelding, naam, aantal (aanpasbaar indien `customer_can_adjust: true`, met `min_quantity`/`max_quantity` grenzen)
- Totaalprijs berekening: dynamisch op basis van gekozen aantallen
- Kortingsbadge: toon `bundle_savings` als die > 0 is
- Originele vs bundelprijs vergelijking

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Bundel query omschrijven naar `product_bundle_items` tabel |

### Geen migratie nodig
De `product_bundle_items` tabel en RLS policies bestaan al.


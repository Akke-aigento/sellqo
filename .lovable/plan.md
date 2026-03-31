

## Fix: Bundelprijzen correct tonen in productoverzichten

### Probleem
De productdetailpagina berekent bundelprijzen correct (dynamisch op basis van child producten), maar het **productoverzicht** (ProductCard, ShopProducts, etc.) toont altijd `product.price` — ook voor bundels met `bundle_pricing_model: 'dynamic'`. Bij dynamic pricing is `product.price` vaak 0 of incorrect.

Twee plekken moeten aangepast worden:

### 1. Storefront API — `getProducts()` verrijken met bundelprijs

**Bestand**: `supabase/functions/storefront-api/index.ts` (regel 612-636)

Nu: retourneert alleen `product.price` voor alle producten, geen bundle-aware data in de lijst.

Fix: Voor producten met `product_type = 'bundle'`, de `product_bundle_items` ophalen en een berekende prijs meegeven:

- Voeg `bundle_pricing_model` toe aan de select query (regel 542)
- Na het ophalen van producten, voor alle bundle-producten in batch de `product_bundle_items` ophalen met child product prijzen
- Bereken `bundle_calculated_price` (som child prijzen × hoeveelheden, minus eventuele korting)
- Retourneer `bundle_pricing_model`, `bundle_calculated_price`, en `bundle_savings` in het product-object

### 2. ProductCard — bundelprijzen renderen

**Bestand**: `src/components/storefront/ProductCard.tsx`

Nu: toont alleen `product.price` en `compare_at_price`.

Fix:
- Interface uitbreiden met `product_type`, `bundle_pricing_model`, `bundle_calculated_price`, `bundle_savings`
- Als `product_type === 'bundle'` en `bundle_pricing_model === 'dynamic'`: toon `bundle_calculated_price` als hoofdprijs
- Als er `bundle_savings > 0`: toon de som van losse prijzen als doorgestreepte "van"-prijs
- Optioneel: toon een "Bundel" badge

### 3. Admin Products overzicht — ook bundelprijs tonen

**Bestand**: `src/pages/admin/Products.tsx` (regel 528-534)

Nu: toont `product.price`.

Fix: Voor bundels met `bundle_pricing_model === 'dynamic'`, de child product prijzen meenemen in de berekening. De `useProducts` hook haalt al `product_categories` op; we voegen een aparte query toe voor bundle items bij dynamic bundles, of berekenen het inline.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | `getProducts()`: bundle_pricing_model in select, batch bundle items ophalen, berekende prijs meegeven |
| `src/components/storefront/ProductCard.tsx` | Bundle-aware prijsweergave met dynamische prijs en besparingsbadge |
| `src/pages/admin/Products.tsx` | Dynamic bundle prijs tonen in admin overzicht |



## Variant voorraad volgt product-niveau `track_inventory`

### Probleem

1. **Admin**: Bij het genereren/aanmaken van varianten wordt `stock` altijd op `0` gezet, ook als het product `track_inventory: false` heeft. De voorraadkolom toont altijd een numeriek veld.
2. **Storefront**: `selectedVariant.in_stock` wordt nooit berekend -- varianten krijgen geen `in_stock` property. Met `stock: 0` toont de storefront "Uitverkocht" voor elke variant, ook bij producten zonder voorraadtracking.

### Oplossing

**1. Storefront: `in_stock` berekenen per variant (`src/hooks/usePublicStorefront.ts`)**

Bij het ophalen van een product met varianten, de `in_stock` property per variant berekenen op basis van het product-niveau `track_inventory`:

```typescript
const variants = (variantsRes.data || []).map(v => ({
  ...v,
  attribute_values: (v.attribute_values as Record<string, string>) || {},
  in_stock: !product.track_inventory || v.stock > 0,
}));
```

Dit zorgt ervoor dat:
- Producten zonder voorraadtracking: alle varianten zijn altijd `in_stock: true`
- Producten met voorraadtracking: variant `in_stock` hangt af van eigen `stock > 0`

**2. Storefront: `stockCount` respecteert `track_inventory` (`src/pages/storefront/ShopProductDetail.tsx` en `src/components/storefront/QuickViewModal.tsx`)**

```typescript
const stockCount = product?.track_inventory 
  ? (selectedVariant?.stock ?? product?.stock) 
  : undefined;
```

Zodat het quantity-veld geen maximum heeft bij producten zonder tracking.

**3. Admin Variants Tab: voorraadkolom aanpassen (`src/components/admin/products/ProductVariantsTab.tsx`)**

- De component krijgt een nieuwe prop: `trackInventory: boolean`
- Als `trackInventory` is `false`:
  - De Voorraad-kolom toont "oneindig symbool" in plaats van een getal
  - Bij het bewerken is het voorraadveld uitgeschakeld of verborgen
- Als `trackInventory` is `true`:
  - Voorraad wordt normaal getoond en bewerkbaar (huidige gedrag)

**4. Admin ProductForm: prop doorgeven (`src/pages/admin/ProductForm.tsx`)**

De `track_inventory` waarde doorgeven aan `ProductVariantsTab`:

```typescript
<ProductVariantsTab 
  productId={product.id} 
  trackInventory={form.watch('track_inventory')} 
/>
```

**5. Variant generatie: standaard `stock` op `null` bij geen tracking (`src/hooks/useProductVariants.ts`)**

Bij het genereren van varianten, als het product geen voorraad bijhoudt, `stock` niet op 0 zetten. Aangezien de database-kolom een default van 0 heeft, is dit cosmetisch (de storefront `in_stock` berekening lost het echte probleem op).

### Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/usePublicStorefront.ts` | `in_stock` per variant berekenen |
| `src/pages/storefront/ShopProductDetail.tsx` | `stockCount` respecteert `track_inventory` |
| `src/components/storefront/QuickViewModal.tsx` | Idem |
| `src/components/admin/products/ProductVariantsTab.tsx` | Nieuwe prop `trackInventory`, voorraadkolom conditioneel |
| `src/pages/admin/ProductForm.tsx` | `trackInventory` prop doorgeven |

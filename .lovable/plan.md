
# Fase 3: Frontend Variant Selection UI voor ShopProductDetail.tsx

## Huiding Status
Het backend is volledig geimplementeerd:
- `product_variants` en `product_variant_options` tabellen bestaan
- `getProduct` edge function retourneert `variants[]` en `options[]` arrays
- `CartContext` ondersteunt `variantId` in `CartItem`
- `cart_add_item` edge function accepteert en valideert `variant_id`

**Ontbrekend:** De frontend variant selection UI in `ShopProductDetail.tsx`

---

## Frontend Implementatie Plan

### 1. **Variant Options UI Component (Dropdowns/Buttons)**

Na de product naam en categorie link, voeg een **Variant Selection Sectie** toe met:
- Voor elke optie in `product.options` (bijv. "Kleur", "Maat"):
  - Label: `option.name`
  - UI: Dropdown (`<Select>`) component of Button group (`<ToggleGroup>`)
  - Values: `option.values[]` (bijv. ["Rood", "Blauw", "Groen"])
  
- State management: 
  - Nieuwe state: `selectedAttributes: Record<string, string>` (bijv. `{color: "Rood", size: "L"}`)
  - Helper function: `getSelectedVariant()` die de variant zoekt met overeenkomende `attribute_values`

**UI Pattern:** Dropdown is eenvoudiger voor veel values; buttons voor 3-5 values.

### 2. **Dynamische Prijs & Voorraad Update**

Als variant geselecteerd:
- Toon variant-specifieke prijs (fallback naar product prijs als variant.price null)
- Toon variant-specifieke stock status
- Update "in_stock" boolean

Formule:
```
selectedVariant = product.variants.find(v => 
  JSON.stringify(v.attribute_values) === JSON.stringify(selectedAttributes)
)
displayPrice = selectedVariant?.price ?? product.price
displayComparePrice = selectedVariant?.compare_at_price ?? product.compare_at_price
inStock = selectedVariant?.in_stock ?? product.in_stock
```

### 3. **Variant Image Swap**

Als variant `image_url` heeft:
- Set `selectedImage = 0` en toon variant image in plaats van product image
- Fallback naar product images als variant geen image heeft

### 4. **Cart Add-to-Cart Logic Update**

Hudig: `handleAddToCart()` stuurt geen `variantId`

Nieuw:
- Valideer dat variant geselecteerd (indien `product.has_variants === true`)
- Stuur `variant_id` naar `addToCart()` function
- Stuur `variantTitle` (bijv. "Rood / L") mee
- Toast bericht: `"${quantity}x ${product.name} (${variantTitle}) toegevoegd"`

**Validation Logic:**
```typescript
if (product.has_variants && !selectedVariant) {
  toast.error("Selecteer alstublieft alle opties");
  return;
}
```

### 5. **UI Layout**

Tussen product naam en prijs:
```
[Product Naam]
[Price]

[Variant Selection Section]
- Kleur: [Dropdown] Rood ▼
- Maat: [Toggle] [S] [M] [L] [XL]
- Voorraad Status: "Op voorraad (5 stuks)" of "Uitverkocht"

[Quantity Selector + Add to Cart]
```

---

## State & Logic Updates

### State toevoegen:
```typescript
const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
const [selectedVariant, setSelectedVariant] = useState<any>(null);
```

### Helper functie:
```typescript
const getSelectedVariant = useCallback(() => {
  if (!product?.variants || !Object.keys(selectedAttributes).length) return null;
  return product.variants.find(v => 
    JSON.stringify(v.attribute_values) === JSON.stringify(selectedAttributes)
  );
}, [product?.variants, selectedAttributes]);

// Sync state
useEffect(() => {
  setSelectedVariant(getSelectedVariant());
}, [getSelectedVariant]);
```

### Update `handleAddToCart`:
```typescript
const handleAddToCart = () => {
  if (!product) return;
  
  // Validation
  if (product.has_variants && !selectedVariant) {
    toast.error("Selecteer alstublieft alle opties");
    return;
  }
  
  const variantTitle = selectedVariant 
    ? Object.values(selectedVariant.attribute_values).join(" / ")
    : null;
  
  addToCart({
    productId: product.id,
    name: product.name,
    price: selectedVariant?.price ?? product.price,
    quantity,
    image: selectedVariant?.image_url ?? product.images?.[0],
    sku: selectedVariant?.sku ?? product.sku,
    variantId: selectedVariant?.id,
    variantTitle: variantTitle,
  });
  
  toast.success(`${quantity}x ${product.name}${variantTitle ? ` (${variantTitle})` : ""} toegevoegd aan winkelwagen`, {...});
};
```

### Update prijs weergave:
```typescript
const displayPrice = selectedVariant?.price ?? product.price;
const displayComparePrice = selectedVariant?.compare_at_price ?? product.compare_at_price;
const hasDiscount = displayComparePrice && displayComparePrice > displayPrice;

// In JSX: toon displayPrice en displayComparePrice in plaats van product.price
```

### Update stock status:
```typescript
const inStock = selectedVariant?.in_stock ?? product.in_stock;
const stock = selectedVariant?.stock ?? product.stock;

// Toon: "Op voorraad (5 stuks)" als stock beschikbaar
```

---

## Bestanden Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/storefront/ShopProductDetail.tsx` | Voeg variant selection UI, state, en logic toe |
| `src/context/CartContext.tsx` | Voeg `variantId` en `variantTitle` toe aan CartItem (al gedaan in vorige phase) |

---

## UI Components Gebruikt

Bestaande in project:
- `<Select>` (Radix UI) voor dropdown opties
- `<ToggleGroup>` / `<ToggleGroupItem>` (Radix UI) voor button selection (optioneel)
- `<Button>` voor quantity controls
- Bestaande prijs/stock styling

---

## Technische Opmerkingen

1. **Attribute matching:** JSONB `attribute_values` moet exact matchen (string comparison na JSON.stringify)
2. **Variant image fallback:** Als variant geen image, toon product image (niet grijs uit maken)
3. **Quantity selector:** Zet max quantity naar variant stock als beschikbaar
4. **Performance:** `useCallback` op helper functies om re-renders te voorkomen

---

## Implementatie Volgorde

1. State toevoegen: `selectedAttributes`, `selectedVariant`
2. Helper functies: `getSelectedVariant()`, effect hook
3. Variant options UI renderen (onder product naam)
4. Dynamische prijs/stock update
5. Variant image swap
6. Update `handleAddToCart()` logic
7. Validation toevoegen
8. Testen end-to-end op product met varianten



## Fix: HTML-tags worden als tekst getoond op de publieke website

### Probleem

Op de gepubliceerde storefront worden HTML-tags (zoals `<p>`, `<strong>`) als platte tekst weergegeven in plaats van als opgemaakte content. Dit komt doordat React standaard HTML-strings escaped -- je moet `dangerouslySetInnerHTML` gebruiken om HTML correct te renderen.

### Gevonden locaties

| Bestand | Regel | Probleem |
|---|---|---|
| `src/pages/storefront/ShopProducts.tsx` | 125 | Categorie-beschrijving wordt als platte tekst gerenderd |
| `src/components/storefront/ProductCard.tsx` | 192-194 | `short_description` wordt als platte tekst gerenderd (detailed card style) |

De volgende bestanden doen het al **correct** met `dangerouslySetInnerHTML`:
- `ShopProductDetail.tsx` (product description)
- `ShopPage.tsx` (page content)
- `ShopLegalPage.tsx` (legal page content)
- `QuickViewModal.tsx` (product description)

### Oplossing

**1. `src/pages/storefront/ShopProducts.tsx` -- regel 124-126**

Vervang de `<p>` tag door een `<div>` met `dangerouslySetInnerHTML` en prose-styling:

```tsx
{selectedCategory?.description && (
  <div 
    className="text-muted-foreground mt-1 prose prose-sm max-w-none"
    dangerouslySetInnerHTML={{ __html: selectedCategory.description }}
  />
)}
```

**2. `src/components/storefront/ProductCard.tsx` -- regel 191-195**

Vervang de `<p>` tag door een `<div>` met `dangerouslySetInnerHTML`:

```tsx
{cardStyle === 'detailed' && product.short_description && (
  <div 
    className="text-xs text-muted-foreground mt-1.5 line-clamp-2"
    dangerouslySetInnerHTML={{ __html: product.short_description }}
  />
)}
```

### Samenvatting

| Bestand | Wijziging |
|---|---|
| `src/pages/storefront/ShopProducts.tsx` | Categorie-beschrijving: `dangerouslySetInnerHTML` + prose styling |
| `src/components/storefront/ProductCard.tsx` | Short description: `dangerouslySetInnerHTML` |

### Resultaat

Alle teksten op de publieke website worden correct als opgemaakte HTML weergegeven in plaats van als raw tags.

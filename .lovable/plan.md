

## Fix: Categorie-beschrijvingen in CategoriesGridSection tonen HTML als tekst

### Probleem

In de nieuwe Categorieën Grid sectie op de homepage worden categorie-beschrijvingen als raw HTML getoond (bijv. `<p><strong>Sweaters</strong></p>`). Dit is hetzelfde probleem dat eerder is opgelost in ShopProducts en ProductCard.

### Oplossing

In `src/components/storefront/sections/CategoriesGridSection.tsx` regel 109: de `<p>` tag vervangen door een `<div>` met `dangerouslySetInnerHTML` en prose-styling.

### Wijziging

**`src/components/storefront/sections/CategoriesGridSection.tsx` -- regel 108-110**

Van:
```tsx
{content.show_description && cat.description && (
  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
)}
```

Naar:
```tsx
{content.show_description && cat.description && (
  <div 
    className="text-sm text-muted-foreground mt-1 line-clamp-2 prose prose-sm max-w-none"
    dangerouslySetInnerHTML={{ __html: cat.description }}
  />
)}
```

| Bestand | Wijziging |
|---|---|
| `src/components/storefront/sections/CategoriesGridSection.tsx` | `dangerouslySetInnerHTML` voor beschrijving |


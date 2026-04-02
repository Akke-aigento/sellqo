

## Meerdere categorieën tonen in productenoverzicht

### Probleem

De categorie-kolom (regel 521-527 in `Products.tsx`) toont alleen `product.category` (de legacy single relatie). Producten met meerdere categorieën via de junction-tabel tonen slechts de primaire categorie.

### Oplossing

**`src/pages/admin/Products.tsx`** — Vervang de single-badge weergave door alle gekoppelde categorieën uit `product_categories`:

```tsx
<TableCell className="hidden lg:table-cell">
  {(product as any).product_categories?.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {(product as any).product_categories
        .slice(0, 3)
        .map((pc: any) => {
          const cat = categories.find(c => c.id === pc.category_id);
          return cat ? (
            <Badge key={cat.id} variant="outline" className="text-xs">{cat.name}</Badge>
          ) : null;
        })}
      {(product as any).product_categories.length > 3 && (
        <Badge variant="secondary" className="text-xs">
          +{(product as any).product_categories.length - 3}
        </Badge>
      )}
    </div>
  ) : product.category ? (
    <Badge variant="outline">{product.category.name}</Badge>
  ) : (
    <span className="text-muted-foreground">-</span>
  )}
</TableCell>
```

- Toont maximaal 3 badges + een "+N" overflow indicator
- Fallback naar legacy `product.category` voor backwards compatibility

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Products.tsx` | Categorie-cel aanpassen voor multi-category weergave |

### Geen database wijzigingen nodig


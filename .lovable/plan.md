

## Fix: Categorie-filter houdt geen rekening met niet-primaire categorieën

### Probleem
Het productenfilter op `Products.tsx` regel 124 checkt alleen `product.category_id` (het legacy veld = primaire categorie). Producten die via de junction-tabel `product_categories` aan meerdere categorieën zijn gekoppeld, worden niet gevonden als je filtert op een niet-primaire categorie.

### Oplossing

**1. `src/hooks/useProducts.ts` — Product categories meeladen in de lijst-query**

De `productsQuery` select uitbreiden met de junction-tabel:

```sql
*, category:categories(id, name, slug), product_categories(category_id)
```

Dit geeft per product een array `product_categories: [{category_id: '...'}]`.

**2. `src/pages/admin/Products.tsx` — Filter aanpassen (regel 124)**

Vervang:
```ts
if (categoryFilter !== 'all' && product.category_id !== categoryFilter) return false;
```

Door:
```ts
if (categoryFilter !== 'all') {
  const allCategoryIds = (product as any).product_categories?.map((pc: any) => pc.category_id) || [];
  if (!allCategoryIds.includes(categoryFilter) && product.category_id !== categoryFilter) return false;
}
```

Dit checkt zowel de junction-tabel als het legacy veld.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/hooks/useProducts.ts` | `product_categories(category_id)` toevoegen aan select |
| `src/pages/admin/Products.tsx` | Filter checkt alle gekoppelde categorieën |


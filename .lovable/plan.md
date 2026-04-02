

## Fix: Producten met meerdere categorieën tonen in alle gekoppelde categorieën

### Probleem

`usePublicProducts` filtert op `category_id` (de legacy single-kolom):
```typescript
query = query.eq('category_id', options.categoryId);
```

Producten die via de `product_categories` junction-tabel aan meerdere categorieën gekoppeld zijn, verschijnen alleen bij hun primaire categorie.

### Oplossing

**`src/hooks/usePublicStorefront.ts`** — categorie-filter via junction-tabel

Vervang de `.eq('category_id', ...)` filter door een twee-stap aanpak:

1. Eerst product IDs ophalen uit `product_categories` voor de gewenste categorie
2. Dan producten filteren op die IDs

```typescript
if (options?.categoryId) {
  // Haal alle product IDs op die aan deze categorie gekoppeld zijn
  const { data: linkedProducts } = await supabase
    .from('product_categories')
    .select('product_id')
    .eq('category_id', options.categoryId);
  
  const linkedIds = (linkedProducts || []).map(lp => lp.product_id);
  
  if (linkedIds.length > 0) {
    query = query.in('id', linkedIds);
  } else {
    // Fallback: legacy category_id kolom
    query = query.eq('category_id', options.categoryId);
  }
}
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/usePublicStorefront.ts` | Categorie-filter via `product_categories` junction-tabel |

### Geen database wijzigingen nodig




## Fix: Bulk categorie-aanpassingen worden niet weergegeven

### Root cause

De bulk categorie-operatie **slaat wél op** in de `product_categories` junction-tabel (de toast bevestigt "1 operatie succesvol"). Het probleem is dat de **weergave** de verkeerde databron leest:

- **Lijstweergave** (regel 638-643): toont `product.category.name` — dit komt uit de legacy `category_id` FK-kolom op de `products` tabel (single-category join). De bulk edit schrijft naar de `product_categories` junction-tabel maar raakt de legacy kolom niet aan.
- **productCategoryMap** (regel 102-118): wordt wél correct opgebouwd uit de junction-tabel, maar wordt alleen gebruikt voor **filtering**, niet voor weergave.

### Fix

**`src/pages/admin/Products.tsx`**

1. **Categorie-kolom weergave aanpassen** (regel 638-643): In plaats van `product.category?.name`, de categorieën ophalen uit `productCategoryMap[product.id]` en de namen resolven via de `categories` array. Toon meerdere badges als een product meerdere categorieën heeft.

2. **productCategoryMap herladen na bulk edit**: Na succesvolle bulk operatie `queryClient.invalidateQueries` triggert al een `products` refetch, wat de `useEffect` op `[products]` herstart. Maar de `useEffect` runt async en kan een race condition hebben. Fix: ook expliciet de map refreshen na bulk edit (of de dependency aanpassen).

3. **Grid-weergave categorie-kolom**: Controleren of de grid view dezelfde fix nodig heeft.

### Technisch

```text
Nu:     Categorie kolom → product.category.name (legacy FK join, single)
Straks: Categorie kolom → productCategoryMap[product.id] → categories lookup (junction, multi)
```

### Bestanden
- `src/pages/admin/Products.tsx` — categorie-weergave omschakelen van legacy FK naar junction-tabel map




## Bugfix: Multi-categorie koppeling wordt niet opgeslagen

### Root cause analyse

In `src/hooks/useProductCategories.ts`, de `syncCategories` mutation:

1. **Delete error wordt niet gecheckt** (regel 37-40): Als de delete faalt door RLS, geeft Supabase `{ data: [], error: null }` terug maar worden er geen rijen verwijderd. De code gaat gewoon door.
2. **Insert faalt dan op unique constraint**: De oude rij (Sweaters) bestaat nog, insert van dezelfde category_id faalt.
3. **Error wordt ingeslikt**: De insert error wordt wel gegooid, maar `form.handleSubmit(onSubmit)` in react-hook-form vangt async errors op zonder feedback aan de gebruiker.

Bewijs: de `created_at` van de enige `product_categories` rij is `2026-02-24` (de migratie-seed datum), wat bevestigt dat syncCategories nooit succesvol heeft gedraaid.

### Oplossing

**1. `src/hooks/useProductCategories.ts` — Robuustere sync strategie**

Vervang de delete-all + insert-all aanpak door:
- **Check delete errors** en gooi ze
- Gebruik een **twee-stappen benadering**:
  - Verwijder rijen die niet meer in de lijst staan: `.delete().eq('product_id', productId).not('category_id', 'in', '(ids)')`
  - Upsert de gewenste rijen met `onConflict: 'product_id,category_id'`
- Dit is robuuster tegen race conditions en RLS-issues

```typescript
// Stap 1: Verwijder categorieën die niet meer gekoppeld zijn
if (categoryIds.length > 0) {
  const { error: delError } = await supabase
    .from('product_categories')
    .delete()
    .eq('product_id', productId)
    .not('category_id', 'in', `(${categoryIds.join(',')})`);
  if (delError) throw delError;
} else {
  const { error: delError } = await supabase
    .from('product_categories')
    .delete()
    .eq('product_id', productId);
  if (delError) throw delError;
}

// Stap 2: Upsert de gewenste categorieën
const { error } = await supabase
  .from('product_categories')
  .upsert(rows, { onConflict: 'product_id,category_id' });
if (error) throw error;
```

**2. `src/pages/admin/ProductForm.tsx` — Error feedback toevoegen**

Wrap de `onSubmit` in een try-catch met toast feedback:
```typescript
const onSubmit = async (data: FormValues) => {
  try {
    // ... existing logic
  } catch (err: any) {
    toast.error(err?.message || 'Opslaan mislukt');
  }
};
```

### Bestanden
- `src/hooks/useProductCategories.ts` — Robuustere sync met error checking + upsert
- `src/pages/admin/ProductForm.tsx` — Try-catch met toast error feedback


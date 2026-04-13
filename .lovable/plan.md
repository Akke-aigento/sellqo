

# Fix: FloatingSaveBar verschijnt niet bij afbeelding- en variantwijzigingen

## Probleem

De `FloatingSaveBar` op het productformulier gebruikt `form.formState.isDirty` van react-hook-form. Dit werkt niet voor:

1. **Afbeeldingen**: `form.setValue('images', ...)` wordt aangeroepen zonder de `{ shouldDirty: true }` optie, waardoor het formulier niet als "dirty" gemarkeerd wordt.
2. **Varianten**: Variant-wijzigingen (toevoegen, bewerken, verwijderen, afbeelding koppelen) gaan volledig buiten het react-hook-form om — ze gebruiken directe Supabase mutations in `useProductVariants`. Het formulier weet niet dat er iets veranderd is.

## Oplossing

### 1. Afbeeldingen: `shouldDirty: true` toevoegen

In `ProductForm.tsx`, bij alle `form.setValue()` calls voor `images` en `featured_image`, de optie `{ shouldDirty: true }` toevoegen:

```typescript
form.setValue('images', currentImages, { shouldDirty: true });
form.setValue('featured_image', url, { shouldDirty: true });
```

Dit betreft de functies: `handleImageUpload`, `removeImage`, `setFeaturedImage`.

### 2. Varianten: geen FloatingSaveBar nodig

Variant-wijzigingen worden **direct opgeslagen** via mutations (`updateVariant.mutate`, `createVariant.mutate`, etc.) — ze gaan niet via het formulier. Er is dus geen "onopgeslagen wijziging" om te tonen. Dit is correct gedrag.

De fix is dus beperkt tot de afbeeldingen en andere `setValue` calls die `shouldDirty` missen (tags, SEO velden, etc.).

### Bestanden

- **`src/pages/admin/ProductForm.tsx`**: Alle `form.setValue()` calls voorzien van `{ shouldDirty: true }` waar dat nog ontbreekt. Dit betreft ~15-20 plekken, waaronder images, featured_image, tags, product_type gerelateerde velden, en SEO velden.


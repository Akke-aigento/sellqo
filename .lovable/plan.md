

# Fix: Bewerk-knop tonen voor alle afbeeldingen in Assets

## Probleem
Op regel 106 van `MediaAssetsLibrary.tsx` staat:
```tsx
{isProduct && onEdit && (
```
De `onEdit` prop wordt correct doorgegeven voor alle image-assets, maar de **Wand2-knop** (✨) wordt alleen gerenderd als `isProduct === true`. Categorie- en upload-afbeeldingen krijgen de knop dus nooit te zien.

## Oplossing
**Bestand:** `src/components/admin/marketing/MediaAssetsLibrary.tsx`

Regel 106 wijzigen van:
```tsx
{isProduct && onEdit && (
```
naar:
```tsx
{onEdit && (
```

Dat is de enige wijziging die nodig is. De `onEdit` prop is al correct ingesteld op regel 485 voor alle image-types.


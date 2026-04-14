

# Afbeelding bewerker beschikbaar maken voor alle assets

## Probleem
De "Bewerken"-knop (die de `ImageEditorDialog` opent) is momenteel alleen beschikbaar voor assets met `source === 'product'`. Upload-assets en categorie-assets hebben deze optie niet — zij kunnen alleen de achtergrond laten verwijderen via bulk-selectie.

## Oplossing
Eén simpele wijziging in `MediaAssetsLibrary.tsx`:

**Regel 485** — de `onEdit` prop wordt nu alleen doorgegeven voor product-assets:
```tsx
onEdit={asset.source === 'product' ? () => handleEditProductImage(asset) : undefined}
```

Dit aanpassen zodat alle image-assets (product, upload, category) de editor kunnen openen:
```tsx
onEdit={asset.file_type.startsWith('image/') ? () => handleEditProductImage(asset) : undefined}
```

Daarnaast de `productName` in de `ImageEditorDialog` aanpassen zodat deze ook voor niet-product assets een zinvolle naam toont (bijv. `categoryName` of `file_name`).

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/components/admin/marketing/MediaAssetsLibrary.tsx` | `onEdit` voor alle image-assets inschakelen, naam-fallback verbeteren |


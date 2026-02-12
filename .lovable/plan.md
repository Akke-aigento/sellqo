
# Preview: geen redirect naar ongeverifieerd domein

## Probleem
De preview iframe laadt `/shop/{slug}`, maar ShopLayout redirect automatisch naar het custom domein of de custom frontend URL — ook als het domein nog niet geverifieerd is. Hierdoor werkt de preview niet.

## Oplossing
Een `?preview=true` query parameter toevoegen aan de preview URL. ShopLayout controleert deze parameter en slaat de redirect-logica over wanneer het in preview-modus draait.

---

## Technische Details

### `src/components/admin/storefront/PreviewPanel.tsx`

Voeg `?preview=true` toe aan de preview URL:

```typescript
const previewUrl = currentTenant 
  ? `/shop/${currentTenant.slug}?preview=true` 
  : '/shop/preview';
```

De "Open extern" knop opent zonder de preview parameter (dus het echte gedrag):

```typescript
const handleOpenExternal = () => {
  const externalUrl = currentTenant 
    ? `/shop/${currentTenant.slug}` 
    : '/shop/preview';
  window.open(externalUrl, '_blank');
};
```

### `src/components/storefront/ShopLayout.tsx`

In de redirect useEffect (regel 39-68), controleer op de preview parameter en sla redirects over:

```typescript
useEffect(() => {
  if (!tenant?.id || !themeSettings || redirecting) return;

  // Skip redirects in preview mode
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') === 'true') return;

  const checkRedirect = async () => {
    // ... bestaande redirect logica blijft ongewijzigd
  };

  checkRedirect();
}, [tenant?.id, themeSettings, redirecting]);
```

| Bestand | Wijziging |
|---|---|
| `PreviewPanel.tsx` | `?preview=true` toevoegen aan iframe URL |
| `ShopLayout.tsx` | Redirect overslaan bij `preview=true` parameter |

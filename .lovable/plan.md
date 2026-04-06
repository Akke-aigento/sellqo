

## Download-knop toevoegen voor productafbeeldingen

### Probleem
Tenants kunnen hun productafbeeldingen niet downloaden vanuit het admin dashboard. Er is geen download-knop aanwezig bij de afbeeldingen in het ProductForm.

### Oplossing
Voeg een download-knop toe naast de bestaande knoppen (hoofdafbeelding instellen, verwijderen) in de hover-overlay van elke productafbeelding.

### Wat er verandert

**`src/pages/admin/ProductForm.tsx`** — regel 1491-1497

Voeg een download-knop toe aan de hover-overlay van elke afbeelding:

```tsx
<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
  <Button type="button" size="icon" variant="secondary" onClick={() => setFeaturedImage(url)} title="Maak hoofdafbeelding">
    <Star className={...} />
  </Button>
  {/* NIEUW: Download knop */}
  <Button type="button" size="icon" variant="secondary" onClick={() => downloadImage(url, `product-${index + 1}`)} title="Downloaden">
    <Download className="h-4 w-4" />
  </Button>
  <Button type="button" size="icon" variant="destructive" onClick={() => removeImage(url)} title="Verwijderen">
    <X className="h-4 w-4" />
  </Button>
</div>
```

Plus een `downloadImage` helper die via `fetch` + `blob` + tijdelijk `<a>` element de afbeelding downloadt (nodig omdat het cross-origin URLs zijn — een gewone `<a download>` werkt niet cross-origin):

```typescript
const downloadImage = async (url: string, filename: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
};
```

Import `Download` icon van lucide-react toevoegen.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/ProductForm.tsx` | Download-knop + helper functie toevoegen |

### Geen database wijzigingen nodig


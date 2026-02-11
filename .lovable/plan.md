

# Fix: TipTap toolbar-acties werken niet

## Probleem
De console toont: **"Duplicate extension names found: ['link', 'underline']"**. In TipTap v3 zijn `Link` en `Underline` al onderdeel van `StarterKit`. Door ze nogmaals apart toe te voegen ontstaan duplicaten, waardoor de editor niet correct werkt -- headings, lijsten, bold, etc. doen allemaal niets.

## Oplossing
In `src/components/admin/products/ProductDescriptionEditor.tsx`:

1. **Verwijder de losse `Underline` import en extensie** -- StarterKit bevat dit al
2. **Verwijder de losse `Link` import en extensie** -- StarterKit bevat dit al
3. **Configureer Link en Underline via StarterKit** in plaats van apart, zodat er geen duplicaten zijn

### Concrete wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/products/ProductDescriptionEditor.tsx` | Verwijder dubbele `Link` en `Underline` extensies, configureer ze via StarterKit |

### Code-aanpak

```tsx
// VOOR (broken):
extensions: [
  StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
  Underline,                    // DUPLICAAT
  Link.configure({ ... }),      // DUPLICAAT
  Image.configure({ ... }),
  Placeholder.configure({ ... }),
],

// NA (fixed):
extensions: [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: { openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } },
    underline: true,
  }),
  Image.configure({ ... }),
  Placeholder.configure({ ... }),
],
```

Dit lost alle toolbar-problemen op: headings, lijsten, bold, italic, underline, links -- alles werkt weer correct.


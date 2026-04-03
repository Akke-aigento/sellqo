

## Fix: Variant knoppen triggeren productformulier submit

### Probleem

De `ProductVariantsTab` zit binnen een `<form onSubmit={form.handleSubmit(onSubmit)}>` (regel 577 van ProductForm.tsx). Alle `<Button>` componenten in de variant tab zonder expliciet `type="button"` gedragen zich als submit-buttons, waardoor het hele productformulier wordt opgeslagen wanneer je op het potlood (edit), vinkje (save), kruisje (cancel), of andere knoppen klikt.

### Oplossing

Voeg `type="button"` toe aan alle `<Button>` elementen in `ProductVariantsTab.tsx` die geen form-submit moeten triggeren. Dit betreft circa 15 buttons:

- Optie edit/save/cancel knoppen
- Optie toevoegen knop
- Varianten genereren knop
- Variant edit (pencil), save (check), cancel (x) knoppen
- Link/unlink knoppen
- Dialog knoppen

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/products/ProductVariantsTab.tsx` | `type="button"` toevoegen aan alle Button elementen |

### Geen database wijzigingen nodig


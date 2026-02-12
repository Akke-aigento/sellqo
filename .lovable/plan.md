
# Rich Text Editor voor Categorie Beschrijving

## Probleem
De categoriebeschrijving gebruikt momenteel een simpel tekstveld (`Textarea`) met een limiet van 500 tekens. Dit is te beperkt en biedt geen opmaakopties. Het moet dezelfde rich text editor gebruiken als bij producten.

## Oplossing
Vervang de `Textarea` in `CategoryFormDialog.tsx` door de bestaande `ProductDescriptionEditor` component (TipTap rich text editor) en verhoog de tekenlimiet naar 5000 tekens, net als bij producten.

## Wijzigingen

### 1. `src/components/admin/CategoryFormDialog.tsx`
- Importeer `ProductDescriptionEditor` uit `@/components/admin/products/ProductDescriptionEditor`
- Verhoog de Zod-validatie van `.max(500)` naar `.max(5000)` voor het `description` veld
- Vervang het `Textarea` veld door de `ProductDescriptionEditor` component
- Koppel de `value` en `onChange` props aan het react-hook-form veld

### Technische details

**Zod schema aanpassing (regel 50):**
```
description: z.string().max(5000, 'Beschrijving mag maximaal 5000 tekens zijn').optional()
```

**Formulierveld aanpassing (regels 280-297):**
Vervang de `Textarea` door:
```tsx
<ProductDescriptionEditor
  value={field.value || ''}
  onChange={field.onChange}
  maxLength={5000}
/>
```

Dit hergebruikt de bestaande editor die al ondersteuning biedt voor:
- Vetgedrukt, cursief, onderstrepen, doorhalen
- Koppen (H2, H3, H4)
- Opsommingslijsten en genummerde lijsten
- Links en afbeeldingen
- Undo/redo
- Tekenteller met waarschuwing bij nadering limiet

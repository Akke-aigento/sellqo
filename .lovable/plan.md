
## Plan: hele kortingscode-tegel klikbaar maken

### Wat wijzigt
In `src/components/admin/DiscountCodeCard.tsx` wordt de hele card klikbaar zodat een klik overal op de tegel direct de "Bewerken"-dialog opent.

### Aanpak
1. Voeg `onClick={() => onEdit(discountCode)}` + `cursor-pointer` toe op de `<Card>` zelf.
2. Stop event-propagation op de interactieve sub-elementen die NIET mogen triggeren als bewerken:
   - Copy-knop (kopieert code naar klembord) → `e.stopPropagation()`
   - DropdownMenu trigger (3 bolletjes) → `e.stopPropagation()` op de trigger button
   - Dropdown-items "Bewerken" en "Verwijderen" blijven werken zoals nu (Verwijderen mag niet ook bewerken triggeren)
3. Voeg een lichte hover-styling toe (bestaande `hover:shadow-md` blijft, eventueel `hover:bg-muted/30`) voor visuele feedback dat de tegel klikbaar is.

### Waarom alleen deze file
`Discounts.tsx` geeft al `onEdit` door aan de card — geen wijziging nodig in de parent. Pure UI-tweak, geen logica, geen backend.

### Niet aanraken
- Geen wijziging aan delete-flow, dropdown-acties, of types.
- Geen impact op andere kaarten (gift/bundles/etc.) — uitsluitend `DiscountCodeCard.tsx`.

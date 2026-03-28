

## Bundel Items: Checkboxen + Min Quantity op 0

### Twee wijzigingen

**1. Popover blijft open — checkboxen i.p.v. single-select**
- Verwijder `setBundlePopoverOpen(false)` na selectie zodat de popover open blijft
- Voeg een `Checkbox` toe per product in de `CommandItem`
- Aangevinkte producten = al in bundel (klik = verwijder)
- Niet-aangevinkte producten = klik = toevoegen
- Zo kan je snel meerdere producten aan/uitvinken zonder steeds opnieuw te openen

**2. Minimum quantity op 0 toestaan = "niet verplicht"**
- Verander `min="1"` naar `min="0"` op het **Aantal** veld (regel 1251) en het **Minimum** veld (regel 1290)
- Verander de `Math.max(1, ...)` naar `Math.max(0, ...)` in de onChange handlers
- Quantity 0 = product is optioneel in de bundel (niet verplicht)
- Voeg een klein label/hint toe: "Zet op 0 voor optioneel"

### Bestand
`src/pages/admin/ProductForm.tsx` — alleen dit bestand wijzigt

### Geen database wijzigingen nodig
De `quantity` kolom accepteert al 0. Geen migratie vereist.


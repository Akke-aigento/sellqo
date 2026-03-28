

## Bundel Product Zoeken: Dropdown Combobox

### Probleem
Het huidige zoekveld toont pas resultaten na 2 tekens typen. De gebruiker wil een dropdown die direct producten toont bij klik/focus — zoals een combobox.

### Oplossing
Vervang het huidige `Input` + custom dropdown door een `Popover` + `Command` (cmdk) combobox patroon dat al in het project gebruikt wordt. Dit toont direct alle beschikbare producten bij focus/klik, met zoekfunctionaliteit bovenaan.

### Wijzigingen

**`src/pages/admin/ProductForm.tsx`** (regels 1164-1225)
- Vervang `Input` + relatieve dropdown door `Popover` + `Command` component
- `CommandInput` voor zoeken
- `CommandList` met `CommandItem` per product (afbeelding + naam + prijs)
- Popover opent bij klik op trigger-knop ("Zoek product om toe te voegen...")
- Sluit automatisch na selectie
- Filtert al toegevoegde producten en bundels eruit

### Technisch
- Gebruikt bestaande shadcn `Command` + `Popover` componenten (al in project)
- Geen nieuwe dependencies
- Zelfde `allProducts` data als nu, zelfde add-logica




## Fix: Bewerkknop variant veroorzaakt pagina-redirect

### Oorzaak
De `ProductVariantsTab` zit in een `<form>` element (in `ProductForm.tsx`, regel 439). Wanneer je op het bewerkpotlood klikt, is de `<Button>` standaard van `type="submit"` -- hierdoor wordt het formulier verzonden, het product opgeslagen, en navigeert de pagina terug naar het productoverzicht.

### Oplossing
In `src/components/admin/products/ProductVariantsTab.tsx` moeten alle interactieve `<Button>`-elementen expliciet `type="button"` krijgen, zodat ze het formulier niet per ongeluk versturen. Dit geldt voor:

- Bewerkknop (potlood-icoon, regel 458)
- Opslaan-knop (vinkje, regel 449)
- Annuleren-knop (kruisje, regel 452)
- Optie-bewerk knop (regel 173, 176, 185)
- "Toevoegen" knop (regel 242)
- "Varianten genereren" knop (regel 250)
- Ontkoppelen-knop (regel 425)
- Koppelen-knop (regel 435)
- Afbeelding-verwijderknop (regel 305)

Daarnaast voegen we `e.stopPropagation()` toe aan de bewerkknop als extra veiligheid.

### Technische details

**1 bestand aangepast**: `src/components/admin/products/ProductVariantsTab.tsx`

Alle `<Button>` componenten binnen dit bestand krijgen `type="button"` zodat geen enkele klik onbedoeld het bovenliggende formulier indient. Dit is een paar regels per knop en lost het probleem volledig op.


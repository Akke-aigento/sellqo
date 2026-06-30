## Doel
Vergelijkingsprijs (`compare_at_price`) en kostprijs (`cost_price`) ook bewerkbaar maken per variant — in lijn met wat al kan op het hoofdproduct.

## Status van de stack
- DB-kolommen bestaan al op `product_variants` (`compare_at_price`, `cost_price`).
- `VariantFormData` in `useProductVariants.ts` heeft beide velden al → backend mutatie is al klaar.
- Alleen de UI in `ProductVariantsTab.tsx` toont/edit ze nog niet (en `startEditVariant` neemt `cost_price` nog niet mee in de edit-state).

## Wijzigingen (alleen `src/components/admin/products/ProductVariantsTab.tsx`)

1. **Edit-state uitbreiden** in `startEditVariant`: ook `compare_at_price` en `cost_price` van de variant in `editVariantData` zetten.

2. **Card-layout (mobile/smal, <900px)**
   - Edit-modus: extra inputs "Van-prijs" en "Kostprijs" toevoegen aan de 2-koloms grid (naast Prijs).
   - Read-modus: van 4-koloms grid naar compactere weergave die Van-prijs en Kostprijs toont onder Prijs (doorstreept tonen `compare_at_price` zoals al elders in de app), met `—` als ze leeg zijn.

3. **Tabel-layout (desktop, ≥900px)**
   - Twee nieuwe kolommen toevoegen aan de tabel-header: "Van-prijs" en "Kostprijs", direct na "Prijs".
   - Per rij: in edit-modus een `Input type="number" step="0.01"` voor beide velden; in read-modus `€xx.xx` of `—`. Kostprijs in gedempte tekst (`text-muted-foreground`) om subtieler te zijn.

## Guardrails
- Geen DB-migraties, geen wijzigingen aan `useProductVariants.ts`, types of andere componenten.
- Leeg invullen ⇒ `null` (zelfde patroon als de bestaande `price`-input).
- Geen invloed op bulk-edit, grid-view of het hoofdproduct-formulier.
- Bestaande layout-breakpoint (900px) blijft staan — door 2 extra kolommen wordt de tabel iets voller, maar dat is acceptabel; geen nieuwe breakpoint nodig.

## Test
Open een product met varianten → variant bewerken → Van-prijs & Kostprijs invullen → opslaan → herladen → waarden blijven en tonen correct in zowel kaart- als tabel-weergave.
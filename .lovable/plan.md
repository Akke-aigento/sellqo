

# Fix: Varianten layout responsive maken

## Probleem

De variantentabel heeft 8 kolommen (Foto, Variant, SKU, Prijs, Voorraad, Actief, Gekoppeld product, Acties). Op smaller schermen (zoals de huidige 768px viewport) vallen de actie-knoppen (bewerken/verwijderen) buiten beeld, waardoor ze onbereikbaar zijn. De `overflow-x-auto` wrapper helpt niet genoeg omdat gebruikers niet doorhebben dat ze moeten scrollen.

## Oplossing

Vervang de tabel door een **responsive card-layout op mobiel** (< 1024px) terwijl de tabel op desktop bewaard blijft:

### Bestand: `src/components/admin/products/ProductVariantsTab.tsx`

1. **Desktop (≥ 1024px)**: Behoud de huidige tabel, maar verberg de "Gekoppeld product" kolom standaard (verplaats naar een detail-sectie per variant) om ruimte te besparen.

2. **Mobiel (< 1024px)**: Render elke variant als een compacte card:
   - Bovenkant: thumbnail + variant-titel + actie-knoppen (bewerken, verwijderen) altijd zichtbaar
   - Onderkant: grid met SKU, Prijs, Voorraad, Actief status
   - Koppeling-badge inline getoond
   - Edit-modus: velden worden inline inputs binnen de card

3. **Acties altijd bereikbaar**: Op beide layouts staan bewerken/verwijderen knoppen direct zichtbaar, niet verscholen achter horizontale scroll.

4. **Optie-toevoegen formulier**: Het huidige `grid-cols-[200px_1fr_auto]` grid stacken op mobiel naar `grid-cols-1` zodat de invoervelden niet afgekapt worden.

### Aanpak

- Gebruik Tailwind responsive classes (`hidden lg:table-cell`, `lg:hidden`)
- Eén component, twee render-paden via responsive classes
- Geen nieuwe dependencies


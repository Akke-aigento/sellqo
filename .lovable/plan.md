
# Kleurpalet Generator Responsief Maken

## Probleem

De `ColorPaletteGenerator` gebruikt `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` voor de 5 paletten. Maar omdat het component zit in de smalle sidebar-kolom (niet de volle paginabreedte), slaan de `md:` en `lg:` breakpoints nooit aan. Resultaat: alle 5 paletten staan in een lange verticale lijst die wordt afgekapt door de ScrollArea.

## Oplossing

Twee aanpassingen:

1. **Grid aanpassen**: Verander naar `grid-cols-1 sm:grid-cols-2` zodat er op de meeste schermbreedtes al 2 kolommen getoond worden, zelfs in de smalle sidebar. Dit maakt de 5 paletten compacter en voorkomt dat ze buiten beeld vallen.

2. **Palette kaarten compacter**: De mini-preview hoogte (`h-12`) en padding iets verkleinen zodat meer paletten in beeld passen.

## Technische Wijziging

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/ColorPaletteGenerator.tsx` | Grid class wijzigen van `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` naar `grid-cols-2 gap-2` zodat de 5 paletten altijd in 2 kolommen tonen (3 + 2 rijen). Padding en spacing iets verkleinen voor compactere weergave. |

Dit is een minimale CSS-only wijziging in 1 bestand.

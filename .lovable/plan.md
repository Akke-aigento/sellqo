## Probleem

Wanneer "Voorraad bijhouden" uit staat op een product, toont de **admin productenlijst** alsnog een rode **"Uitverkocht"** badge zodra de stock 0 is (of, bij varianten, zodra alle varianten 0 zijn). De storefront werkt correct — daar wordt `track_inventory` wél in de check meegenomen — dus dit is puur een UI-bug in de admin.

Locatie: `src/pages/admin/Products.tsx`
- `getStockBadge()` (rond regel 330) kijkt enkel naar `effectiveStock` zonder `track_inventory` te checken.
- Het stock-filter (regel 160-167) doet hetzelfde, waardoor niet-getrackte producten verkeerd uit "Op voorraad" filteren.

## Wat ga ik aanpassen

**Enkel `src/pages/admin/Products.tsx`** — geen backend, geen storefront-wijzigingen.

1. **`getStockBadge()`** — als `track_inventory === false` (én er zijn geen actieve varianten die wél tracking hebben), toon een neutrale grijze badge **"Niet bijgehouden"** in plaats van Uitverkocht / aantallen.

2. **Stock-filter** — niet-getrackte producten beschouwen als "Op voorraad" zodat ze niet onterecht in de Uitverkocht-filter verschijnen en niet wegvallen uit de Op voorraad-filter.

3. **Effectieve stock voor variant-producten** — als de parent én alle actieve varianten tracking uit hebben staan, ook "Niet bijgehouden" tonen. Als sommige varianten wel tracken: huidige som-logica behouden.

## Verificatie

- Product "Loveke Cadeaukaart" (track_inventory=false, stock=0) → toont nu **"Niet bijgehouden"**, niet meer "Uitverkocht".
- Bundles van VanXcel (track_inventory=false, stock=1000) → tonen ook **"Niet bijgehouden"** (consistent).
- Normaal fysiek product met tracking aan en stock=0 → blijft "Uitverkocht".
- Filter "Op voorraad" toont nu ook niet-getrackte producten; "Uitverkocht" verbergt ze.

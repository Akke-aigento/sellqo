

# Productfoto's tonen in de Assets-bibliotheek

## Probleem
De Assets-tab in Sellqo AI toont alleen bestanden uit de `media_assets`-tabel. Productfoto's (opgeslagen als `images[]` in de `products`-tabel) verschijnen daar niet. Logischerwijs verwacht een tenant al zijn visueel materiaal op één plek.

## Oplossing
De `MediaAssetsLibrary` uitbreiden zodat de "Producten"-folder automatisch alle productfoto's toont naast handmatig geüploade assets. Geen database-wijzigingen nodig.

### Aanpak

**Bestand:** `src/components/admin/marketing/MediaAssetsLibrary.tsx`

1. **Productfoto's ophalen** — `useProducts` hook importeren en alle productafbeeldingen als "virtuele assets" meenemen wanneer de folder "products" of "all" actief is.

2. **Samenvoegen in één grid** — Productfoto's omzetten naar hetzelfde `MediaAsset`-achtige formaat (met productnaam als titel, `source: 'product'` badge) en samenvoegen met de bestaande `media_assets` resultaten.

3. **Visueel onderscheid** — Productfoto's krijgen een klein "Product"-badge op de kaart zodat je het verschil ziet met geüploade marketing-assets.

4. **Klikacties** — Bij productfoto's opent een klik de `ImageEditorDialog` (AI achtergrondbewerking) in plaats van standaard asset-acties. Zo kunnen tenants direct vanuit Assets hun productfoto's bewerken.

5. **Zoeken** — De zoekbalk filtert ook op productnaam bij productfoto's.

### Wat er niet verandert
- Geen database-migraties
- Bestaande upload/favoriet/verwijder-functionaliteit voor echte media_assets blijft intact
- Andere folders (Campagnes, Social, Favorieten) blijven ongewijzigd


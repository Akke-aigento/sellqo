

## Varianten toevoegen voor Mancini Milano producten

### Huidige situatie
Van de T-shirts, Hoodies, Jackets en Tracksuits van Mancini Milano missen **6 producten** nog varianten. Alle Jackets en Tracksuits zijn al volledig ingericht.

### Producten die varianten nodig hebben

| Product | Categorie | Prijs | Kleur (uit beschrijving/naam) |
|---------|-----------|-------|-------------------------------|
| "BLUE STORM" LUXE TEE | T-shirts | €110 | Blauw (1 kleur) |
| Diamond Silence Tee | T-shirts | €110 | Zwart (1 kleur) |
| Doberman Power Tee | T-shirts | €47.95 | Blauw (1 kleur) |
| Il cane del Barocco | T-shirts | €110 | Zwart (1 kleur) |
| Silent Authority | T-shirts | €89.95 | Zwart (1 kleur) |
| Cosmic Dragon | Hoodies | €94.95 | Zwart (1 kleur) |

Alle producten hebben op basis van hun beschrijvingen en foto's slechts **1 kleur**, dus kleur-varianten zijn niet van toepassing. Ik voeg voor elk product **Maat (S, M, L, XL)** toe — 4 varianten per product, 24 varianten totaal.

### Wat ik ga doen

**Stap 1: Data-inserts via database tools**
- Per product: 1 rij in `product_variant_options` (name: "Maat", values: ["S","M","L","XL"])
- Per product: 4 rijen in `product_variants` met:
  - `title`: "S", "M", "L", "XL"
  - `attribute_values`: `{"Maat": "S"}` etc.
  - `price`: overgenomen van het hoofdproduct
  - `stock`: 10 per variant (standaard)
  - `is_active`: true, `track_inventory`: true

**Stap 2: Geen code-wijzigingen nodig**
Het bestaande variant-systeem (opties + varianten + storefront hydration) werkt al volledig. De producten verschijnen automatisch met maatkeuze op de webshop.

### Resultaat
- 6 producten krijgen elk 4 maatvarianten (S/M/L/XL)
- 24 varianten totaal
- Direct zichtbaar en bestelbaar op de storefront


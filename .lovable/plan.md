
## Fix: Variant-selectie layout en data-structuur

### Het probleem (wat je ziet in de screenshot)

De variant-opties zijn **verkeerd opgeslagen** in de database. In plaats van:

```text
Option: "Maat" -> values: ["XS", "S", "M", "L", "XL"]
```

Staat er nu **5 losse opties**, elk met 1 waarde:

```text
Option: "XS" -> values: ["Extra Small"]
Option: "S"  -> values: ["Small"]
Option: "M"  -> values: ["Medium"]
...
```

En er is maar **1 variant** met alle maten tegelijk als attribute_values, in plaats van 5 aparte varianten (1 per maat). Daardoor:
- Elk formaat krijgt zijn eigen label + knop (de kapotte layout die je ziet)
- De "Add to Cart"-knop stuurt altijd dezelfde variant door, ongeacht welke "maat" je aanklikt
- De voorraad is niet per maat bij te houden

### De oplossing (2 onderdelen)

**Deel 1 -- Data repareren (eenmalig, voor dit product)**

Via een database-migratie de bestaande foutieve data corrigeren:
- De 5 losse opties verwijderen
- 1 nieuwe optie aanmaken: `name: "Maat"`, `values: ["XS", "S", "M", "L", "XL"]`
- De 1 samengestelde variant verwijderen
- 5 aparte varianten aanmaken: elk met `attribute_values: { "Maat": "XS" }` etc.

**Deel 2 -- Voorraadlogica koppelen aan variant-selectie**

In `ShopProductDetail.tsx`:
- De `inStock`-check voor varianten correct berekenen: `!variant.track_inventory || variant.stock > 0`
- De hoeveelheid-selector (quantity +/-) begrenzen op de geselecteerde variant-voorraad
- De quantity resetten naar 1 wanneer een andere variant wordt geselecteerd
- Uitverkochte variant-waarden visueel markeren (disabled/doorgestreept) in de VariantSelector

In `VariantSelector.tsx`:
- Een optioneel `variants`-prop toevoegen zodat de selector weet welke waarden uitverkocht zijn
- Uitverkochte opties tonen met een visuele indicatie (bijv. doorgestreepte tekst, grijze knop) maar nog steeds klikbaar met een tooltip "Uitverkocht"

### Technische details

**Database migratie** -- Data corrigeren voor het specifieke product "Sweater Oversized - Loveke Classic":
- DELETE de 5 foutieve `product_variant_options` records
- INSERT 1 correcte optie met `name: 'Maat'` en `values: ['XS','S','M','L','XL']`
- DELETE de 1 foutieve variant
- INSERT 5 correcte varianten met individuele `attribute_values`

**Bestand 1: `src/components/storefront/VariantSelector.tsx`**
- `variants` prop toevoegen (optioneel, array van varianten)
- Per optie-waarde checken of er een matching variant is en of die op voorraad is
- Uitverkochte waarden visueel markeren maar niet uitschakelen (klant kan nog steeds kiezen)

**Bestand 2: `src/pages/storefront/ShopProductDetail.tsx`**
- `variants` doorgeven aan de VariantSelector component
- `inStock` voor varianten berekenen met track_inventory logica: `!selectedVariant.track_inventory || selectedVariant.stock > 0`
- Quantity resetten naar 1 bij variant-wissel
- Quantity maximum begrenzen op basis van geselecteerde variant stock (al deels aanwezig, maar variant.stock wordt niet correct uitgelezen)

### Resultaat

```text
Maat — XS
[ XS ] [ S ] [ M ] [ L ] [ XL ]
                                    (uitverkocht = doorgestreept/grijs)

Aantal: [  -  ]  1  [  +  ]    [ Toevoegen aan winkelwagen ]
```

### Scope
- 1 database migratie (data fix voor het betreffende product)
- 2 bestanden aangepast (VariantSelector + ShopProductDetail)



# Variant-afbeeldingen koppelen via bestaande productfoto's

## Wat er al werkt
- `product_variants.image_url` kolom bestaat al in de database
- De webshop toont al de variant-afbeelding als eerste foto wanneer een variant geselecteerd wordt
- De winkelwagen gebruikt al `selectedVariant.image_url` als afbeelding
- De Storefront API stuurt `image_url` mee bij varianten in cart en orders

## Wat er mist
De admin UI (ProductVariantsTab) heeft geen mogelijkheid om per variant een foto te selecteren uit de bestaande productafbeeldingen.

## Plan

### 1. ProductVariantsTab uitbreiden met afbeelding-kolom

**Bestand:** `src/components/admin/products/ProductVariantsTab.tsx`

- Component ontvangt een nieuwe prop `productImages: string[]` (de bestaande afbeeldingen van het product)
- Voeg een "Afbeelding" kolom toe aan de variantentabel
- Toon een kleine thumbnail (of placeholder) per variant
- Bij klik opent een popover/dialog met een grid van alle productafbeeldingen om uit te kiezen
- Geselecteerde afbeelding wordt opgeslagen via de bestaande `updateVariant.mutate({ id, data: { image_url } })`
- Mogelijkheid om de afbeelding weer te verwijderen (terug naar null)

### 2. ProductForm.tsx: images doorgeven aan ProductVariantsTab

**Bestand:** `src/pages/admin/ProductForm.tsx`

- Geef de huidige `images` array door als prop: `<ProductVariantsTab productId={id} productImages={formData.images} />`

### 3. Bestaande edit-mode meenemen

In de inline edit-modus van een variant wordt de image_url ook meegenomen in `editVariantData`, zodat wijzigingen consistent opgeslagen worden.

## Geen database- of API-wijzigingen nodig
Alles is al aanwezig in de backend. Dit is puur een admin frontend aanpassing.


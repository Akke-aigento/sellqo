

## Variant-afbeeldingen: kleurwisseling met eigen foto's

### Wat er nu al werkt
De storefront-code is **al volledig voorbereid**: wanneer een variant een `image_url` heeft, toont `ShopProductDetail` die afbeelding bovenaan de galerij. Bij kleurwissel springt de foto automatisch mee. Het enige wat ontbreekt is de admin-kant: je kunt nu geen afbeelding koppelen aan een variant.

### Wat er verandert

**Bestand 1: `src/components/admin/products/ProductVariantsTab.tsx`**

- Een nieuwe kolom "Afbeelding" toevoegen aan de varianten-tabel
- Bij bewerken van een variant verschijnt een upload-knop (camera-icoontje) waarmee je een afbeelding uploadt naar de `product-images` bucket
- Een thumbnail-preview tonen in de tabel (klein vierkantje, 40x40px)
- Mogelijkheid om de afbeelding te verwijderen (kruisje op de thumbnail)
- De `image_url` wordt meegestuurd bij opslaan via de bestaande `updateVariant` mutatie

**Bestand 2: `src/hooks/useProductVariants.ts`**

- `image_url` toevoegen aan het `startEditVariant` data-object zodat het correct wordt meegenomen bij inline editing

### Hoe het werkt in de praktijk

1. Je maakt opties aan: **Kleur** (Rood, Blauw, Zwart) en **Maat** (S, M, L, XL)
2. Je genereert varianten -> 12 combinaties verschijnen
3. Bij elke kleur-variant upload je een eigen afbeelding (bijv. rode versie van het product)
4. Op de webshop: klant selecteert "Blauw" -> productfoto wisselt automatisch naar de blauwe versie
5. Maat wisselen verandert de foto niet (tenzij je daar ook een aparte foto aan koppelt)

### Technische details

- Hergebruik van de bestaande `useImageUpload` hook voor uploads naar `product-images` bucket
- De kolom `image_url` op `product_variants` bestaat al in de database -- geen migratie nodig
- De storefront-logica in `ShopProductDetail.tsx` hoeft niet aangepast te worden: `displayImages` en `selectedVariant.image_url` werken al correct
- Upload-pad: `{tenant_id}/variants/{variant_id}_{timestamp}.{ext}` voor nette organisatie

### Scope
- 2 bestanden aangepast
- 0 database-wijzigingen
- 0 storefront-wijzigingen (dat werkt al)

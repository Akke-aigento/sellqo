

## Fix: Featured image correct doorgeven via Shopify sync + Storefront API

### Probleem
Er zijn twee problemen waardoor de verkeerde afbeelding als hoofdafbeelding wordt getoond:

1. **Shopify sync** (`sync-shopify-products/index.ts` regel 104): de images worden opgeslagen als `shopifyProduct.images.map(img => img.src)` — maar **zonder te sorteren op `position`** en **zonder `featured_image` te zetten**. Shopify geeft elk image-object een `position` veld (1 = hoofdafbeelding), maar dat wordt genegeerd.

2. **Storefront API** (`storefront-api/index.ts` regel 667-668): de `images` array wordt ongewijzigd doorgestuurd. Als `featured_image` wel correct is ingesteld, staat die niet gegarandeerd op `images[0]`.

### Oplossing

**Bestand 1: `supabase/functions/sync-shopify-products/index.ts`**
- Images sorteren op `position` voordat ze worden opgeslagen (Shopify's `position` 1 = hoofdafbeelding)
- `featured_image` zetten op de eerste gesorteerde image URL (= de hoofdafbeelding uit Shopify)

```text
// Huidige code (regel 104):
images: shopifyProduct.images?.map((img: any) => img.src) || [],

// Nieuwe code:
const sortedImages = (shopifyProduct.images || [])
  .sort((a: any, b: any) => (a.position ?? 999) - (b.position ?? 999))
const imageUrls = sortedImages.map((img: any) => img.src)

// In productData:
images: imageUrls,
featured_image: imageUrls[0] || null,
```

**Bestand 2: `supabase/functions/storefront-api/index.ts`**
- In de response-mapping: als `featured_image` bestaat, deze als eerste in de `images` array plaatsen (dedupliceren)

```text
// Regel 667-668 aanpassen:
const featImg = product.featured_image || (product.images?.[0] || null);
const orderedImages = featImg 
  ? [featImg, ...(product.images || []).filter(i => i !== featImg)]
  : (product.images || []);

images: orderedImages,
featured_image: featImg,
```

### Bestanden die wijzigen
- `supabase/functions/sync-shopify-products/index.ts` — images sorteren + featured_image zetten
- `supabase/functions/storefront-api/index.ts` — images array herordenen met featured_image eerst

### Resultaat
- Bij Shopify-sync worden afbeeldingen in de juiste volgorde opgeslagen en de hoofdafbeelding ingesteld
- De storefront API garandeert dat `featured_image` altijd de aangeduide hoofdafbeelding is en dat `images[0]` daar mee overeenkomt
- Producten die al in het dashboard een hoofdafbeelding hebben ingesteld, werken direct correct via de API




## Featured image toevoegen aan product list-endpoint

### Probleem
De `getProducts` functie in `storefront-api/index.ts` haalt `featured_image` niet op uit de database en stuurt het niet mee in de response. De storefront kan daardoor niet bepalen welke afbeelding de hoofdafbeelding is.

### Oplossing (Optie 1 + 3 gecombineerd)

**Bestand: `supabase/functions/storefront-api/index.ts`**

1. **Select-query uitbreiden** (regel 547): `featured_image` toevoegen aan de select-string.

2. **Response-mapping uitbreiden** (regel 663-681): `featured_image` veld toevoegen dat de `featured_image` kolom teruggeeft, of als fallback `images[0]`. Hierdoor heeft de storefront altijd een betrouwbare hoofdafbeelding.

Resulterende response per product:
```json
{
  "id": "...",
  "name": "...",
  "featured_image": "https://cdn.shopify.com/.../front-image.png",
  "images": ["https://cdn.shopify.com/.../back.png", "https://cdn.shopify.com/.../front.png"],
  ...
}
```

### Impact
- Eén bestand wijzigt, twee regels aangepast
- Geen breaking change — het is een nieuw veld in de response
- Edge function wordt automatisch gedeployed


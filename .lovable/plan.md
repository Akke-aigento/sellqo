
## Diagnose
Ik heb de keten nagekeken en de kern is nu duidelijk:

- In de SellQo backend staat product **"No Face"** al verkeerd opgeslagen:
  - `featured_image` = achterkant
  - `images[0]` = achterkant
- De Mancini Milano storefront zelf sorteert daarna al correct op basis van `featured_image`, dus het probleem zit **niet** in de storefront.
- De list API geeft dus simpelweg foutieve brondata door.

## Waarschijnlijke oorzaak
Er zijn nu twee import/sync-routes die dit kunnen veroorzaken:

1. **Shopify automatische sync**
   - gebruikt `shopifyProduct.images[].position`
   - zet `featured_image = imageUrls[0]`
   - dit is alleen correct als Shopify’s API-volgorde/position ook echt overeenkomt met de dashboard-hoofdafbeelding

2. **Shopify handmatige CSV-import**
   - `src/lib/shopifyImportParsers.ts` bouwt `images` puur op volgorde van CSV-regels
   - `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` slaat `images` op, maar zet **geen** `featured_image`
   - daardoor blijft of ontstaat een verkeerde hoofdafbeelding bij handmatige imports

Daarnaast heeft dit specifieke product nu:
- geen `shopify_product_id`
- geen `shopify_last_synced_at`

Dat wijst erop dat **"No Face" waarschijnlijk niet via de automatische Shopify product-sync is bijgewerkt**, maar via handmatige invoer/import of dashboard-opslag.

## Plan van aanpak

### 1. Fix handmatige Shopify CSV-import
Bestanden:
- `src/lib/shopifyImportParsers.ts`
- `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx`

Aanpassingen:
- Shopify CSV-parser uitbreiden zodat de hoofdafbeelding expliciet herkend wordt:
  - voorkeur voor rij waar `Image Position` / `Image Position`-achtig veld op hoofdpositie wijst
  - fallback: eerste afbeelding
- bij import ook `featured_image` opslaan naast `images`
- optioneel: `images` direct herschikken zodat `featured_image` altijd op index 0 staat

### 2. Hardening in product save-flow vanuit dashboard
Bestanden:
- `src/pages/admin/ProductForm.tsx`
- eventueel `src/hooks/useProducts.ts`

Aanpassingen:
- als een gebruiker in het dashboard een hoofdafbeelding kiest:
  - `featured_image` opslaan
  - `images` herschikken zodat gekozen hoofdafbeelding altijd eerste staat
- bij verwijderen van de hoofdafbeelding blijft fallback naar nieuwe `images[0]` bestaan

Zo blijft database-data consistent, ook buiten Shopify-sync om.

### 3. Hardening in storefront API behouden/verbeteren
Bestand:
- `supabase/functions/storefront-api/index.ts`

Controle / eventuele aanscherping:
- `featured_image` blijven teruggeven
- `images` altijd normaliseren naar:
  - `featured_image` eerst
  - daarna overige afbeeldingen zonder duplicaten

Dit is een extra veiligheidslaag, maar lost alleen nieuwe responses op — niet de foutieve opgeslagen productdata zelf.

### 4. Bestaande foutieve producten corrigeren
Omdat "No Face" nu al verkeerd in de database staat, is ook een data-correctie nodig.

Uit te voeren in implementatiemodus:
- een gerichte correctie voor bestaande producten met foutieve `featured_image`
- minimaal voor **No Face**
- liefst ook voor producten die via Shopify-import of handmatige import zijn binnengekomen waar:
  - `featured_image` leeg is, of
  - `featured_image` niet overeenkomt met de gewenste hoofdafbeelding

Afhankelijk van wat beschikbaar is, zijn er 2 routes:
- gerichte patch voor bekende producten
- of een veilige backfill op basis van import/source-regels

## Verwacht resultaat
Na deze wijziging:
- `featured_image` in de API komt overeen met de bedoelde hoofdafbeelding
- `images[0]` is dezelfde afbeelding als `featured_image`
- nieuwe handmatige Shopify imports blijven consistent
- dashboard-keuzes voor hoofdafbeelding blijven ook in API-volgorde correct

## Technische details
```text
Bron van probleem nu:
DB record "No Face"
featured_image = back-image
images[0]      = back-image

Storefront normalizer:
- gebruikt featured_image al als prioriteit
- dus frontend volgt de foutieve backend-data correct

Benodigde structurele fix:
Shopify CSV/manual import -> featured_image expliciet zetten
Dashboard save -> images herschikken op featured_image
Storefront API -> featured_image eerst blijven afdwingen
Backfill -> bestaande foutieve records corrigeren
```

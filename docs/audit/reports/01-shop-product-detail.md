# Audit: /shop/:tenantSlug/product/:productSlug — Productdetail
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopProductDetail.tsx (605 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 1 · 🟢 4

## Bevindingen

### 🔴 A1 — Gekoppelde-productvarianten werken niet, en de code erachter zou naar een 404 leiden
- **Wat:** kiest een klant een variant-attribuut dat naar een ánder product verwijst, dan hoort de winkel naar dat product te navigeren. Dat gebeurt nooit.
- **Waar:** `src/pages/storefront/ShopProductDetail.tsx:136-139`
  ```ts
  if (matchingVariant?.linked_product_slug && tenantSlug) {
    navigate(`/shop/${tenantSlug}/${matchingVariant.linked_product_slug}`);
    return;
  }
  ```
- **Root cause — twee fouten die elkaar maskeren:**
  1. **`linked_product_slug` bestaat niet in de opgehaalde data.** De variantenquery (`src/hooks/usePublicStorefront.ts:391`) selecteert `linked_product_id` — nooit `linked_product_slug` — en nergens wordt het veld nadien toegevoegd. In de hele `src/`-boom komt `linked_product_slug` uitsluitend op deze twee regels voor. De conditie is dus **altijd `undefined`** en de tak vuurt nooit.
  2. **Het pad in de `navigate` klopt niet.** De productroute is `/shop/:tenantSlug/product/:productSlug` (`App.tsx:190`); hier wordt `/shop/:tenantSlug/:slug` gebouwd — zonder het segment `product/`. Er bestaat geen route die daarop matcht, dus dit valt door naar de catch-all `*` (`App.tsx:377`) en dus naar `NotFound`.
- **Gevolg vandaag:** stilzwijgend niets. De klant kiest de variant, `setSelectedAttributes` draait, en het product wisselt niet. Wie dit "repareert" door `linked_product_slug` aan de query toe te voegen, verandert de stille storing meteen in een harde 404 op de productpagina.
- **Fixrichting:** `linked_product_slug` meenemen in de variantenquery (of afleiden uit `linked_product_id`) **en** in dezelfde wijziging `/product/` in het pad herstellen. Los van elkaar gerepareerd wordt het erger. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 B1 — Voorraadweergave per variant tegen de live-DB
De pagina leidt voorraad af uit `stockCount` en `track_inventory` (`:464`, `:469`). Of variantvoorraad in productie klopt, en of `track_inventory` per variant of per product geldt, is statisch niet te beslissen.
```sql
SELECT p.name, v.title, v.stock, v.track_inventory, v.is_active, v.linked_product_id
FROM public.product_variants v JOIN public.products p ON p.id = v.product_id
WHERE p.tenant_id = '<tenant>' ORDER BY p.name, v.position LIMIT 30;

-- bestaat de kolom waar de fix op leunt?
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='product_variants' AND column_name LIKE 'linked_product%';
```

## 🟢 Geverifieerd correct
1. **Hoeveelheid is aan beide kanten begrensd.** `:460` blokkeert onder 1, `:464` klemt tegen `stockCount` met `Math.min`, en beide knoppen krijgen een `disabled` die het gedrag volgt — geen dode knop, geen bestelling boven voorraad.
2. **Varianten worden geblokkeerd tot alles gekozen is.** `:469` zet `disabled={product.has_variants && !allOptionsSelected}`; `:145-148` vangt het bovendien in de handler af. Twee sloten op dezelfde deur, geen no-op-knop.
3. **Ontbrekend product geeft een echte fout.** `usePublicStorefront.ts:378-379` gooit `Product not found` bij 0 rijen in plaats van stil een lege pagina te tonen.
4. **Variant-, optie- en bundeldata worden parallel opgehaald** (`usePublicStorefront.ts:389-405`, één `Promise.all`) — geen laad-waterfall en geen N+1.

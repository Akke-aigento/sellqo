# Audit: /shop/:tenantSlug/wishlist — Verlanglijst
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopWishlist.tsx (66 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 1 · 🟢 2

## Bevindingen

### 🔴 B1 — Elk verlanglijst-item claimt "op voorraad", ongeacht de werkelijkheid
- **Wat:** de verlanglijst zet de voorraadstatus van elk product hard op `true`. Een uitverkocht product staat er met een groen voorraadlabel.
- **Waar:** `src/pages/storefront/ShopWishlist.tsx:18-26`
  ```ts
  const products = items.map(item => ({
    id: item.productId, name: item.name, slug: item.slug, price: item.price,
    compare_at_price: null,
    images: item.image ? [item.image] : [],
    in_stock: true,
  }));
  ```
- **Root cause:** `WishlistContext` bewaart een momentopname (id, naam, slug, prijs, afbeelding) en geen voorraad. In plaats van de voorraad op te halen of het label weg te laten, vult de mapping een literal `true` in. `ProductCard` vertrouwt dat veld en toont het als feit.
- **Gevolg:** de verlanglijst is juist de plek waar producten lang blijven staan, dus waar voorraad het meest verschuift. De klant klikt door op een uitverkocht product. Op as B ("mapt elke getoonde waarde naar een echte kolom?") is dit een waarde die nergens op slaat.
- **Nevengevolg:** `compare_at_price: null` staat er om dezelfde reden, waardoor kortingsbadges op de verlanglijst nooit verschijnen — ook als het product in de aanbieding is.
- **Fixrichting:** de opgeslagen id's door `usePublicProducts({ productIds })` halen — die optie bestaat al (`usePublicStorefront.ts:336-338`) en levert `in_stock` en `compare_at_price` correct. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 B2 — Prijzen op de verlanglijst zijn bevroren bij het moment van toevoegen
Zelfde oorzaak: `item.price` komt uit de context, niet uit de DB. Wordt B1 gefixt zoals voorgesteld, dan lost dit mee op. Vraag voor laag 3: hoe vaak wijzigen prijzen echt?
```sql
SELECT count(*) FILTER (WHERE updated_at > now() - interval '30 days') AS gewijzigd_30d,
       count(*) AS totaal
FROM public.products WHERE tenant_id = '<tenant>';
```

## 🟢 Geverifieerd correct
1. **Lege staat is expliciet en klopt.** `:38-47` toont een hart-icoon, "Je verlanglijst is leeg" en een knop naar het productoverzicht — geen stille lege pagina.
2. **De verwijderknop werkt en is herkenbaar.** `:52-57` roept `removeFromWishlist(product.id)` aan, met een `title`-tooltip en een destructieve hover-stijl. Geen dode affordance.

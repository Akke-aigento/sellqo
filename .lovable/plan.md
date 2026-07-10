## Doel
In het productoverzicht (`/admin/products`) toont de prijs-kolom nu altijd `product.price`. Bij producten met varianten waar de hoofdprijs op 0 staat maar de varianten wél een prijs hebben, zie je "€ 0,00" — verwarrend. We tonen daar voortaan de laagst bekende verkoopprijs uit de varianten. Enkel als álle prijzen 0 zijn (hoofd + varianten) blijft € 0,00 staan.

## Wijzigingen

### 1. `src/hooks/useProducts.ts`
De `product_variants` sub-select bevat vandaag alleen `id, stock, track_inventory, is_active`. Voeg `price` toe (beide plekken: regel 23 en regel 300) zodat de UI de prijsdata heeft zonder extra query.

### 2. `src/types/product.ts`
`product_variants?: Array<...>` uitbreiden met `price: number | null`.

### 3. `src/pages/admin/Products.tsx`
Een helper introduceren, bv:

```ts
const getDisplayPrice = (p: Product) => {
  const variantPrices = (p.product_variants ?? [])
    .filter(v => v.is_active !== false)
    .map(v => Number(v.price))
    .filter(n => Number.isFinite(n) && n > 0);
  if ((!p.price || p.price === 0) && variantPrices.length > 0) {
    return Math.min(...variantPrices);
  }
  return p.price ?? 0;
};
```

Regels 620 en 788 (list- en gridweergave) gebruiken deze helper i.p.v. `product.price` direct.

Optioneel: als de weergegeven prijs uit varianten komt, prefixen met "vanaf " zodat duidelijk is dat het een startprijs is. Laat me weten of je dat wil — anders houd ik het bij enkel het bedrag.

## Buiten scope
- Storefront/PDP prijsweergave (die gebruikt al eigen "vanaf"-logica).
- Facturen, offertes, POS — die halen prijzen via aparte paden.
- Compare-at-price gedrag blijft ongewijzigd.

## Vraag
Wil je bij een uit-varianten-afgeleide prijs een "vanaf" prefix in het overzicht, of enkel het bedrag?
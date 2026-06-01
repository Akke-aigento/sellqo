## Doel

Prijs-per-variant gedragen als de bestaande voorraad-per-variant flow: hoofd-verkoopprijs gelockt zodra er actieve varianten zijn, en nieuwe varianten automatisch pre-filled met de hoofdprijs (manuele override blijft gewoon opgeslagen).

## Wijzigingen

### 1. `src/pages/admin/ProductForm.tsx` — Verkoopprijs locken

In de "Prijzen"-card het `price`-veld vervangen door dezelfde conditional als bij voorraad:

- Als `id && product?.product_variants` minstens 1 actieve variant heeft → toon een read-only info-blok (zelfde stijl als "Voorraad wordt per variant beheerd"):
  > **Prijs wordt per variant beheerd**
  > 4 actieve varianten — pas de verkoopprijs aan in het tabblad "Varianten".
- Anders → huidige `Input`-veld blijft zoals het is.

`compare_at_price` en `cost_price` blijven onaangetast (productniveau bewerkbaar).

### 2. `src/hooks/useProductVariants.ts` — Default prijs bij genereren

`generateVariants` mutation accepteert nu een optionele `defaultPrice: number | null`. In de `inserts.map(...)` wordt `price: defaultPrice ?? null` toegevoegd.

`createVariant` mutation: als `price` niet wordt meegegeven door de caller, ook hier de hoofdprijs als default doorgeven (caller-bepaald).

### 3. `src/components/admin/products/ProductVariantsTab.tsx` — Hoofdprijs doorgeven

- Component krijgt al `product` via props (of haalt het op) — verifieer en geef `product.price` mee aan `generateVariants.mutate({ defaultPrice: product.price })` en aan handmatige `createVariant`-calls.
- Bij de "Variant bewerken"-flow: niets veranderen — manuele prijs override werkt al via bestaande `updateVariant`-call.

### 4. Eenmalige data-fix voor tenant Mancini Milano

Migration die alle `product_variants.price` van producten binnen tenant `2606c5b9-caf8-4a42-94cd-80e3f3f31988` overschrijft met `products.price`:

```sql
UPDATE public.product_variants v
SET price = p.price
FROM public.products p
WHERE v.product_id = p.id
  AND p.tenant_id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988';
```

Geen schema-wijzigingen, alleen data-update. `compare_at_price` en `cost_price` van varianten blijven onaangetast.

## Out of scope (expliciet)

- Storefront prijs-fallback (variant.price NULL → product.price) blijft zoals het is; we slaan voortaan altijd de juiste prijs op de variant op, dus geen fallback-aanpassing nodig.
- Bulk "reset alle varianten naar hoofdprijs"-knop in UI — niet gevraagd. Eenmalige tenant-fix volstaat.
- `compare_at_price` / `cost_price` locking — bewust beperkt tot verkoopprijs.

## Verificatie

1. Mancini Milano product met varianten: hoofdprijs-veld toont info-blok, niet bewerkbaar.
2. Nieuw product zonder varianten: prijs-veld werkt normaal.
3. Nieuwe variant genereren: krijgt automatisch hoofdprijs.
4. Variant manueel naar €200 zetten → opslaan → blijft €200 (niet overschreven door hoofdprijs).
5. Na migration: alle Mancini Milano varianten tonen €900 (of de actuele hoofdprijs van hun product).
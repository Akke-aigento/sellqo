
## VAT calculation fix on discounted orders

### Probleem
Bij een korting wordt `tax_amount` opgeslagen op basis van `subtotal` i.p.v. het werkelijk betaalde bedrag (`total = subtotal − discount + shipping`). Voorbeeld: order met subtotaal €59,99, korting −€58,19, totaal €1,80 krijgt `tax_amount = €10,41` opgeslagen, terwijl het correcte BTW-bedrag (incl. 21%) €0,31 is.

### Wijzigingen (3 plekken, identieke fix)

**1. `supabase/functions/stripe-connect-webhook/index.ts` (regel 329)**
```ts
const vatBase = Math.max(0, subtotal - discountAmount + shippingCost);
const vatAmount = Math.round(vatBase * (vatRate / (100 + vatRate)) * 100) / 100;
```

**2. `supabase/functions/storefront-api/index.ts` (regel 1563, `createOrderFromCart`)**
```ts
const vatBase = Math.max(0, total);
const vatAmount = Math.round(vatBase * (vatRate / (100 + vatRate)) * 100) / 100;
```
(`total` staat al op regel 1562)

**3. `supabase/functions/storefront-api/index.ts` (regel 2182, Stripe checkout session handler)**
```ts
const vatBase = Math.max(0, total);
const vatAmount = Math.round(vatBase * (vatRate / (100 + vatRate)) * 100) / 100;
```
(`total` staat al op regel 2181)

### .gitignore
Toevoegen onder `*.local`:
```
.env
.env.local
```
(`*.local` dekt `.env.local` al, maar expliciet toevoegen zoals gevraagd; `.env` ontbreekt en wordt nu wel uitgesloten.)

### Niet aanraken
- `send-order-confirmation`, `generate-invoice`, `create-manual-invoice`, `create-bank-transfer-order` — lezen `tax_amount` of gebruiken een andere correcte formule.
- Stripe charge-bedragen / `total` berekeningen — die zijn al correct.
- Geen retro-actieve migratie op bestaande orders (boekhoudconsistentie met reeds verzonden facturen).

### Deploy
Na de edit: `stripe-connect-webhook` en `storefront-api` Edge Functions herdeployen.

### Verificatie (acceptance)
- Subtotaal €59,99 / korting €58,19 / shipping €0 / 21% → `tax_amount = €0,31`, `total = €1,80` ✅
- Subtotaal €100 / korting €0 / shipping €0 / 21% → `tax_amount = €17,36` (geen regressie) ✅
- Subtotaal €100 / korting €20 / shipping €5 / 21% → vatBase €85 → `tax_amount = €14,79` ✅
- `total = subtotal − discount + shipping` blijft ongewijzigd ✅
- Bevestigingsmail toont automatisch correcte BTW (leest uit `orders.tax_amount`) ✅

<lov-actions>
<lov-suggestion message="Plaats een testbestelling met een kortingscode en controleer dat tax_amount in orders correct is opgeslagen en dat de bevestigingsmail het juiste BTW-bedrag toont.">Test end-to-end met kortingsorder</lov-suggestion>
<lov-suggestion message="Voeg een database CHECK of validatie-trigger toe op de orders tabel die waarschuwt als tax_amount > total bij inclusief-VAT pricing, zodat dit type bug nooit meer onopgemerkt blijft.">Voeg sanity-check toe op orders.tax_amount</lov-suggestion>
<lov-suggestion message="Maak een admin-rapport dat historische orders toont waar tax_amount inconsistent is met (total * vatRate / (100+vatRate)), zodat je kunt beoordelen welke facturen mogelijk handmatig gecorrigeerd moeten worden.">Rapport: inconsistente BTW historisch</lov-suggestion>
</lov-actions>

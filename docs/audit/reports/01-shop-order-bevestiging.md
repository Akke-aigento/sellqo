# Audit: /shop/:tenantSlug/order/:orderId — Orderbevestiging
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopOrderConfirmation.tsx (305 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 1 · 🟢 3

## Bevindingen

### 🔴 B1 — Een mislukte order-ophaling wordt getoond als "geen bestelling"
- **Wat:** gaat het laden van de bestelling mis — netwerkfout, verlopen sessie, fout uit `storefront-api` — dan wordt de fout naar de console geschreven en verdwijnt hij daar. De pagina zet de laadstatus uit en toont haar lege staat, alsof de bestelling niet bestaat.
- **Waar:** `src/pages/storefront/ShopOrderConfirmation.tsx:69-73`
  ```ts
  if (error || !data?.success) {
    console.error('Error loading order:', error || data?.error);
    setIsLoading(false);
    return;
  }
  ```
  Er wordt geen foutstatus gezet; `order` blijft `null` en de render valt terug op de lege tak.
- **Root cause:** dit is precies as B, laatste punt — *"is '0 / geen' écht leeg, of een verborgen laadfout?"* Hier is het het tweede, en de klant kan het verschil niet zien.
- **Gevolg:** de klant heeft net betaald en krijgt te horen dat er niets is. Een tijdelijke storing is niet te onderscheiden van een echt ontbrekende bestelling, en de klant belt de tenant.
- **Bijkomend:** `clearCart()` staat in een effect dat bij elk bezoek draait (`:46-49`), ook wanneer het laden faalt. Wie een verkeerde order-URL opent, verliest zijn winkelwagen. Zelfde patroon als 🔴 A1 in `01-shop-qr-betaling.md`, met kleinere impact omdat deze URL normaal ná het afrekenen wordt bereikt.
- **Fixrichting:** een foutstatus bijhouden en die apart renderen van de lege staat, met de bestaande "Status vernieuwen"-knop als herstelactie. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 E1 — Datum en bedrag staan vast op Nederlandse opmaak
`:80-84` en `:87-91` gebruiken hardcoded `'nl-NL'` in `Intl.NumberFormat` en `toLocaleDateString`. Een Franse of Duitse klant krijgt Nederlandse datumnotatie en scheidingstekens, ook als de rest ooit vertaald wordt. De valuta komt wél uit `tenant.currency` — alleen de *opmaaktaal* ligt vast. Onderdeel van S-3; apart genoteerd omdat het om `Intl` gaat en niet om losse teksten.
**Natrek:** welke locales komen echt voor op orders?
```sql
SELECT locale, count(*) FROM public.orders
WHERE tenant_id = '<tenant>' GROUP BY locale ORDER BY count DESC;
```
**Duiding:** dit meet meteen het effect van S-2 — komt hier vrijwel alleen `nl` uit terwijl de winkel meertalig is, dan bevestigt dat de klachtenlijn.

## 🟢 Geverifieerd correct
1. **De verversknop werkt echt.** `:225` roept `loadOrder` opnieuw aan — geen no-op, en het is de juiste actie voor een overschrijving waarvan de status later binnenkomt.
2. **De uitleg past zich aan de betaalmethode aan.** `:212-223` toont bij een betaalde bestelling een verzendbericht en bij een openstaande overschrijving de verversinstructie — het label volgt het gedrag.
3. **De bestelling wordt via `storefront-api` opgehaald**, niet met een directe tabelquery (`:60-67`). De klant heeft geen rechten op `orders` nodig en er is geen RLS-omweg; de edge function scheidt af op `tenant_id` en `order_id`.

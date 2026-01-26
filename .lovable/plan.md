

# Resterende Issues voor Complete Checkout Flow

Na grondige analyse van de codebase heb ik **1 kritiek database issue** en **4 verbeterpunten** gevonden die nog moeten worden opgelost.

---

## 1. KRITIEK: Ontbrekende `ogm_reference` kolom in orders tabel

**Probleem**: De `ShopOrderConfirmation.tsx` (lijn 32) en `create-bank-transfer-order` edge function verwachten een `ogm_reference` kolom in de `orders` tabel, maar deze kolom bestaat NIET in het database schema.

**Impact**: Bank transfer orders kunnen geen OGM-referentie opslaan, waardoor de QR-code op de bevestigingspagina niet kan worden getoond.

**Oplossing**: Database migratie toevoegen voor `ogm_reference` kolom:
```sql
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ogm_reference TEXT;
```

---

## 2. Stripe Checkout cancel URL redirect mist query parameter handling

**Probleem**: De `create-checkout-session` edge function (lijn 548) stuurt naar `checkout?cancelled=true`, maar `ShopCheckout.tsx` handelt deze query parameter niet af. Gebruikers zien geen feedback dat de betaling is geannuleerd.

**Oplossing**: Toast notificatie toevoegen in `ShopCheckout.tsx` wanneer `?cancelled=true` in de URL staat:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('cancelled') === 'true') {
    toast.info('Je betaling is geannuleerd. Probeer het opnieuw.');
  }
}, []);
```

---

## 3. Cart badge in storefront header

**Probleem**: De `ShopHeader` component toont momenteel geen cart count badge. Gebruikers zien niet hoeveel items in hun winkelwagen zitten.

**Oplossing**: Cart context integreren in `ShopHeader.tsx` voor real-time badge update:
- Import `useCart` hook
- Toon badge met `getCartCount()` bij winkelwagen icoon

---

## 4. Order items `total_price` veld wordt niet correct opgeslagen

**Probleem**: In `create-checkout-session` (lijn 528) wordt `total_price: item.unit_price * item.quantity` berekend, maar in `create-bank-transfer-order` wordt `line_total` gebruikt. Dit kan inconsistentie veroorzaken.

**Oplossing**: Controleer dat beide edge functions dezelfde veldnaam gebruiken (`line_total` of `total_price`) - dit lijkt al correct te zijn, maar het is goed om te verifiëren.

---

## 5. Storefront RLS policies voor order queries

**Probleem**: De `ShopOrderConfirmation.tsx` haalt orders op zonder gebruiker-authenticatie. Dit werkt alleen als de RLS policies correct zijn ingesteld voor publieke toegang tot orders (wat vereist is voor niet-ingelogde klanten die hun order willen bekijken).

**Status**: Dit vereist verificatie. Orders moeten publiek leesbaar zijn op basis van order_id (UUID is moeilijk te raden), OF er moet een order access token systeem worden geïmplementeerd.

---

## Bestanden te wijzigen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| Database migratie | NIEUW | `ogm_reference` kolom toevoegen aan `orders` tabel |
| `src/pages/storefront/ShopCheckout.tsx` | WIJZIG | Cancel redirect handling |
| `src/components/storefront/ShopHeader.tsx` | WIJZIG | Cart count badge |

---

## Prioriteit

1. **P0 - KRITIEK**: `ogm_reference` kolom toevoegen (zonder dit werkt bank transfer NIET)
2. **P1 - Hoog**: Cancel redirect handling
3. **P2 - Medium**: Cart badge in header
4. **P3 - Later**: Order access verificatie

---

## Samenvatting

De checkout flow is bijna compleet. Het belangrijkste resterende issue is de **ontbrekende `ogm_reference` database kolom**. Zonder deze kolom kunnen bank transfer orders hun gestructureerde mededeling niet opslaan en kan de QR-code niet worden getoond aan klanten.

Na het toevoegen van deze kolom is de volledige flow operationeel:
1. Klant voegt producten toe aan cart (werkt)
2. Cart persisteert tussen pagina's (werkt)
3. Checkout toont betaalmethode keuze (werkt)
4. Stripe betalingen werken met correcte redirect
5. Bank transfer orders slaan OGM op en tonen QR-code (vereist fix)
6. Realtime order status updates (werkt)


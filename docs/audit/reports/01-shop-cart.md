# Audit: /shop/:tenantSlug/cart — Winkelwagen
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopCart.tsx (259 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 1 · 🟢 4

## Bevindingen

### 🔴 A1 — De kortingscode-knop valideert niets en weigert élke code
- **Wat:** het kortingscodeveld is een attrappe. Elke ingevoerde code — geldig of niet — levert na een seconde "Ongeldige kortingscode".
- **Waar:** `src/pages/storefront/ShopCart.tsx:55-64`
  ```ts
  const applyDiscount = async () => {
    if (!discountCode.trim()) return;
    setApplyingDiscount(true);
    // Here you would validate the discount code via API
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.error('Ongeldige kortingscode');
    setApplyingDiscount(false);
  };
  ```
- **Root cause:** een placeholder-implementatie die nooit is afgemaakt. De kunstmatige `setTimeout` van 1000 ms bootst een netwerkaanroep na, waardoor het voor de klant én voor de tenant oogt alsof er echt gevalideerd wordt.
- **Waarom dit zwaar weegt:** de backend is er wél. `supabase/functions/storefront-api/index.ts:4310` exporteert de actie `validate_discount_code`, en `validateDiscountCode` draait al productief in de checkout-flow (`:3646`). Tenants beheren kortingscodes in `/admin/orders/discounts` en `/admin/promotions/*`, delen ze in campagnes — en de winkelwagen wijst ze allemaal af. Direct omzetverlies, en de tenant ziet nooit een foutmelding.
- **Fixrichting:** `applyDiscount` de bestaande actie `validate_discount_code` laten aanroepen en de korting op het subtotaal toepassen. **Platform:** CC. **Frozen-path-risico:** nee — de actie bestaat al in het contract, dit is puur additief gebruik.

### 🟡 B1 — Prijzen in de winkelwagen zijn momentopnames
Regelitems komen uit `CartContext` (localStorage). Prijs en voorraad worden niet hervalideerd bij het tonen van de wagen; dat gebeurt pas server-side in de checkout. Een prijswijziging of uitverkoop tussen "toevoegen" en "afrekenen" ziet de klant hier niet.
**Natrek laag 3 — hervalideert `checkout_start` prijzen tegen `products`?**
```sql
SELECT p.id, p.name, p.price, p.stock, p.track_inventory, p.updated_at
FROM public.products p WHERE p.tenant_id = '<tenant>' ORDER BY p.updated_at DESC LIMIT 20;
```
Gedragsvingerafdruk: `cart_add` met een verouderde prijs, dan `checkout_start`, en kijken welk bedrag terugkomt.

## 🟢 Geverifieerd correct
1. **Hoeveelheid omlaag naar 0 verwijdert netjes.** `:43-49` — `handleUpdateQuantity` vangt `newQuantity < 1` af en delegeert naar `handleRemoveItem` in plaats van een 0-hoeveelheid te schrijven.
2. **Verwijderen geeft feedback.** `:51-54` toont een bevestigende toast (zij het hardcoded NL — zie S-3).
3. **Prijsopmaak respecteert de winkelvaluta** via `tenant.currency`.
4. **Geen eigen queries.** De pagina leunt volledig op `CartContext` en `usePublicStorefront`; geen embed-, RLS- of `.maybeSingle()`-risico.

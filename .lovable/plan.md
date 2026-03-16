

## App Screening: Bevindingen & Verbeterpunten

Na een grondige analyse van de codebase heb ik de volgende bevindingen gecategoriseerd op impact.

---

### KRITIEK - Promoties werken niet in de storefront

De hele promotie-engine (`calculateCartPromotions` in `src/lib/promotions/index.ts`) wordt **nergens aangeroepen**. De checkout (`ShopCheckout.tsx`) gebruikt alleen een simpele `appliedDiscount.calculated_amount` van kortingscodes — maar bundels, staffelkortingen, BOGO, automatische kortingen, loyalty, en cadeaukaart-afschrijvingen worden **compleet genegeerd** in de winkelwagen en checkout.

**Impact**: Alle promoties die je nu kunt aanmaken (bundels, volume, BOGO, etc.) doen letterlijk niets voor de klant.

**Fix**: Promotie-engine integreren in CartContext en ShopCheckout zodat alle kortingstypen automatisch worden berekend en getoond.

---

### HOOG - Console warning: SellqoLogo ref

`SellqoLogo` is een function component zonder `forwardRef`, maar wordt gebruikt in `LandingFooter` met een ref. Kleine fix maar zichtbaar in elke console.

**Fix**: Wrap `SellqoLogo` met `React.forwardRef`.

---

### MIDDEL - Ongebruikte code

- `PlaceholderPage.tsx` wordt nergens geïmporteerd
- `src/lib/promotions/` calculators zijn volledig gebouwd maar nooit aangesloten
- Diverse TODO's in de codebase (o.a. `FieldMappingStep.tsx` AI mapping, `useTenantSubscription.ts` storage berekening)

---

### MIDDEL - Cart mist promotie-integratie

Het `CartContext` kent alleen `AppliedDiscountCode` (handmatige kortingscode). Er is geen plek voor:
- Automatische kortingen
- Bundel-samenstellingen
- Loyalty punten redeem/earn
- Cadeaukaart saldo afschrijving
- Gratis verzending door promotie

---

### LAAG - Checkout is 1100+ regels

`ShopCheckout.tsx` is een monoliet (1109 regels) met inline auth, VAT-berekening, adresvalidatie, en betalingslogica. Moeilijk te onderhouden.

---

### Aanbevolen prioriteit

| # | Taak | Impact |
|---|------|--------|
| 1 | **Promotie-engine integreren in storefront** (cart + checkout) | Kritiek — zonder dit werken alle kortingen niet |
| 2 | **SellqoLogo forwardRef fix** | Snel — 2 minuten, verwijdert console warning |
| 3 | **Ongebruikte code opruimen** | Hygiene |
| 4 | **ShopCheckout refactoren** naar kleinere componenten | Onderhoud |

Wil je dat ik begin met **punt 1** (promotie-engine aansluiten op de storefront), of wil je een andere volgorde?


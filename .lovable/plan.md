

## Plan: Klant aanmaken in POS + Loyalty points flow fixen

### 1. Klant rechtstreeks aanmaken in POS

**Probleem**: De `POSCustomerDialog` laat alleen bestaande klanten zoeken en selecteren. Er is geen optie om een nieuwe klant aan te maken — de `Plus` icon is zelfs al geïmporteerd maar niet gebruikt.

**Oplossing**: Een inline "Nieuwe klant" formulier toevoegen aan de `POSCustomerDialog`:

- Een "Nieuwe klant" knop onderaan de zoekresultaten (of als er geen resultaten zijn)
- Bij klik: toon een compact formulier met de belangrijkste velden: voornaam, achternaam, email, telefoon (optioneel)
- Gebruik de bestaande `createCustomer` uit `useCustomers` hook
- Na aanmaken: selecteer de klant automatisch en sluit het formulier

**Bestand**: `src/components/admin/pos/POSCustomerDialog.tsx`

---

### 2. Loyalty points flow — gevonden problemen

Na analyse van de code zijn er twee issues:

#### Issue A: Reguliere betalingen verdienen punten op het totaal inclusief BTW
In `completeTransaction` (lijn 294-300 in POSTerminal.tsx) worden punten verdiend op `cartTotals.total` — dit is het totaalbedrag inclusief BTW. Normaal gesproken worden loyalty punten berekend over het **subtotaal exclusief BTW**, niet het brutobedrag. Dit kan worden gecorrigeerd door `cartTotals.subtotal - cartTotals.discount` te gebruiken.

#### Issue B: Gift card betalingen — punten worden verdiend over het volle bedrag
Bij een multi-payment met gift cards (lijn 384-386) wordt `actualSpent = cartTotals.total - paymentData.loyaltyEuroValue` berekend, maar gift card bedragen worden **niet** afgetrokken. Een klant die €50 betaalt waarvan €30 cadeaukaart, verdient punten over €50 i.p.v. €20.

**Oplossing**: In POSTerminal.tsx:
- `completeTransaction`: verander `cartTotals.total` naar netto besteed bedrag (subtotaal - korting)
- `handleMultiPaymentComplete`: trek ook `giftCardTotal` af bij het berekenen van `actualSpent`

**Bestand**: `src/pages/admin/POSTerminal.tsx`

---

### Samenvatting bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/pos/POSCustomerDialog.tsx` | "Nieuwe klant" formulier + aanmaak flow |
| `src/pages/admin/POSTerminal.tsx` | Fix loyalty points berekening: netto bedrag i.p.v. bruto, gift cards aftrekken |


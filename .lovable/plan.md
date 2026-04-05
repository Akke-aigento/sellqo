

## Fix: EPC QR Code payload — verkeerde veld voor bestelnummer

### Root cause

`ShopQRPayment.tsx` regel 39 stuurt `orderNumber` als `reference` (gestructureerde referentie, EPC regel 10). De functie `generateEPCString` haalt daar vervolgens alle niet-cijfers uit (`/[^\d]/g`), waardoor `VX-2026-01144` wordt tot `202601144`. Dit belandt in het gestructureerde referentie-veld, dat bankapps interpreteren als een OGM-nummer. Het bestelnummer hoort in het **ongestructureerde mededeling-veld** (EPC regel 11 = `text`).

### Fix

**`src/pages/storefront/ShopQRPayment.tsx`** — regel 34-40:
Verander `reference: orderNumber` naar `text: orderNumber`. Geen `reference` meegeven (laat leeg).

```typescript
const epcPayload = generateEPCString({
  bic: bankDetails.bic || "",
  beneficiaryName: bankDetails.account_holder || "",
  iban: bankDetails.iban,
  amount: total,
  text: orderNumber,  // ← was: reference: orderNumber
});
```

**`src/lib/epcQrCode.ts`** — geen wijzigingen nodig. De functie werkt al correct: als `reference` leeg is, wordt regel 10 leeg gelaten en komt `text` op regel 11 terecht. Exact zoals de EPC standaard het vereist.

### Resultaat na fix

```
BCD
002
1
SCT
                          ← BIC (leeg)
VanXcel BV                ← Naam
BE68539007547034          ← IBAN
EUR10.00                  ← Bedrag
                          ← Purpose (leeg)
                          ← Gestructureerde ref (leeg)
VX-2026-01144             ← Mededeling (bestelnummer)
                          ← Display text (leeg)
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/storefront/ShopQRPayment.tsx` | `reference` → `text` voor orderNumber |

### Geen database wijzigingen nodig


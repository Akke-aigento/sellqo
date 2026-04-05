

## Fix: QR Code bankgegevens — veld-naamfout

### Root cause

De `create-bank-transfer-order` edge function retourneert:
```json
{
  "bank_details": {
    "iban": "BE68539007547034",
    "bic": "BPOTBEB1",
    "beneficiary_name": "VanXcel BV",   // ← dit veld
    "ogm_reference": "+++123/4567/89012+++",
    "amount": 10.00,
    "currency": "EUR"
  }
}
```

Maar `ShopQRPayment.tsx` leest `bankDetails.account_holder` — een veld dat **niet bestaat** in de response. Resultaat: de begunstigde naam is een lege string in de EPC payload. De QR code heeft dan een lege regel 6, waardoor sommige bankapps de velden verkeerd interpreteren.

### Fix

**`src/pages/storefront/ShopQRPayment.tsx`** — 2 wijzigingen:

1. Interface aanpassen: `account_holder` → `beneficiary_name` toevoegen
2. `generateEPCString` call: `bankDetails.beneficiary_name` gebruiken i.p.v. `bankDetails.account_holder`
3. Fallback-sectie onderaan: idem

```typescript
// Interface
bankDetails?: {
  account_holder?: string;
  beneficiary_name?: string;  // ← toevoegen
  iban?: string;
  bic?: string;
  reference?: string;
  ogm_reference?: string;     // ← toevoegen
};

// EPC generatie
const epcPayload = generateEPCString({
  bic: bankDetails.bic || "",
  beneficiaryName: bankDetails.beneficiary_name || bankDetails.account_holder || "",
  iban: bankDetails.iban || "",
  amount: total,
  text: orderNumber,
});

// Fallback sectie
<p><strong>Rekeninghouder:</strong> {bankDetails.beneficiary_name || bankDetails.account_holder}</p>
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/storefront/ShopQRPayment.tsx` | Fix veldnamen om overeen te komen met API response |

### Geen database wijzigingen nodig


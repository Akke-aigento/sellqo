

## QR Betaling Flow — Tusschenscherm implementatie

### Huidige situatie

Bij bankoverschrijving gaat de klant direct van de checkout naar de order-bevestigingspagina (`/shop/:tenantSlug/order/:orderId`). De QR-code wordt daar al getoond via het bestaande `BankTransferPayment` component, maar het voelt als een "succes" pagina terwijl er nog niet betaald is.

### Wat er verandert

Een nieuw **tusschenscherm** (`/shop/:tenantSlug/checkout/qr-betaling`) wordt toegevoegd tussen de checkout en de bedanktpagina. Dit scherm toont:
- Grote EPC QR-code (scanbaar met elke Belgische/Nederlandse bankapp)
- Bedrag en bestelnummer
- Stap-voor-stap instructies (open bankapp → scan → bevestig)
- Bankgegevens als fallback (uitklapbaar)
- "Ik heb betaald" knop → navigeert naar de order-bevestigingspagina

### Technische aanpak

**1. Nieuwe pagina: `src/pages/storefront/ShopQRPayment.tsx`**

Een standalone pagina die order-data ontvangt via `navigate()` state:
- `orderNumber`, `orderId`, `total`, `currency`, `qrPayload`, `bankDetails` (iban, bic, beneficiary)
- Genereert de QR-code client-side met het bestaande `react-qr-code` package en `generateEPCString()` uit `src/lib/epcQrCode.ts`
- Als geen state aanwezig → redirect naar shop homepage
- "Ik heb betaald" → navigeert naar `/shop/:tenantSlug/order/:orderId`

**2. Route toevoegen in `src/App.tsx`**

```
/shop/:tenantSlug/checkout/qr-betaling → ShopQRPayment
```

**3. Checkout navigatie aanpassen in `src/pages/storefront/ShopCheckout.tsx`**

Regel 287-288: in plaats van direct naar de order-pagina, navigeer naar het QR tusschenscherm:
```typescript
navigate(`/shop/${tenantSlug}/checkout/qr-betaling`, {
  state: {
    orderId: orderData.order.id,
    orderNumber: orderData.order.order_number,
    total: orderData.order.total,
    currency: orderData.order.currency,
    bankDetails: orderData.bank_details,
  }
});
```

**4. Geen API-wijzigingen nodig**

De `create-bank-transfer-order` edge function retourneert al alle benodigde data (IBAN, BIC, OGM, bedrag). De EPC QR-code wordt client-side gegenereerd.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/storefront/ShopQRPayment.tsx` | Nieuw — QR betaal tusschenscherm |
| `src/App.tsx` | Route toevoegen |
| `src/pages/storefront/ShopCheckout.tsx` | Navigatie na bank_transfer aanpassen |

### Geen database wijzigingen nodig




## Fix: QR tusschenscherm op VanXcel

### Probleem

1. **API** retourneert `payment_type: 'manual'` terwijl het `'qr'` moet zijn (zodat de frontend weet dat er QR-data is)
2. **VanXcel's CheckoutContext** stuurt bij `'qr'` direct naar `/bedankt` in plaats van naar een tusschenscherm

### Wat er moet veranderen

**Project 1: SellQo (dit project) — API fix**

`supabase/functions/storefront-api/index.ts` regel 1726:
- Verander `payment_type: 'manual'` terug naar `payment_type: 'qr'`
- De response bevat al zowel `bank_details` als `qr_data`

**Project 2: [VanXcel](/projects/80408260-c0d8-4f90-a4c4-58c9202792e0) — Frontend fix**

Dit is een **apart project**. De wijzigingen moeten daar gedaan worden:

1. **`src/integrations/sellqo/CheckoutContext.tsx`** regel 253-262: bij `case 'qr'` navigeren naar `/checkout/qr-betaling` i.p.v. `/bedankt`:
```typescript
case 'qr':
  clearStoredCartId();
  navigate('/checkout/qr-betaling', {
    state: {
      orderNumber: data.order_number,
      total: data.total,
      currency: data.currency,
      qrData: data.qr_data,
      bankDetails: data.bank_details,
    },
  });
  break;
```

2. **Nieuwe pagina**: `src/pages/QRPayment.tsx` — tusschenscherm met:
   - Grote EPC QR-code (gegenereerd uit `qr_data.payload`)
   - Bedrag + bestelnummer
   - Stap-voor-stap instructies
   - Bankgegevens als fallback
   - "Ik heb betaald" knop → navigeert naar `/bedankt`

3. **Route** in `src/App.tsx`: `/checkout/qr-betaling` → `QRPayment`

### Aanpak

Stap 1: API fix in dit project (1 regel)
Stap 2: Vraag aan gebruiker om naar het VanXcel project te schakelen voor de frontend-wijzigingen

### Bestanden

| Project | Bestand | Actie |
|---|---|---|
| SellQo | `supabase/functions/storefront-api/index.ts` | `payment_type: 'manual'` → `'qr'` |
| VanXcel | `src/integrations/sellqo/CheckoutContext.tsx` | `'qr'` case → navigate naar tusschenscherm |
| VanXcel | `src/pages/QRPayment.tsx` | Nieuw — QR betaal tusschenscherm |
| VanXcel | `src/App.tsx` | Route toevoegen |




## Bug: Verantwoordelijkheidspopup verschijnt niet meer bij QR overschrijving

### Oorzaak

In `TransactionFeeSettings.tsx` regel 259 staat:

```typescript
if (config.bank_transfer_acknowledged_manual) {
  togglePaymentMethod('bank_transfer');
  return;  // ← skips dialog if previously acknowledged
}
```

Zodra `bank_transfer_acknowledged_manual` eenmaal `true` is opgeslagen in de database, wordt de popup bij elke volgende activering overgeslagen. De popup verschijnt dus alleen de allereerste keer.

### Fix

Verander de logica zodat de popup **altijd** verschijnt wanneer bank transfer wordt ingeschakeld, ongeacht of het eerder al is geacknowledged:

```typescript
const handleBankTransferToggle = () => {
  const isCurrentlyEnabled = config.payment_methods_enabled.includes('bank_transfer');
  if (isCurrentlyEnabled) {
    togglePaymentMethod('bank_transfer');
    return;
  }
  // Always show dialog when enabling bank transfer
  setShowBankTransferDialog(true);
};
```

Dit verwijdert de `if (config.bank_transfer_acknowledged_manual)` check die de popup overslaat.

### Bestanden

- `src/components/admin/settings/TransactionFeeSettings.tsx` — verwijder regels 259-262 (de early return bij acknowledged)

### Resultaat

Elke keer dat een tenant "Directe Bankoverschrijving" inschakelt, verschijnt de verantwoordelijkheidsdialoog — ook als ze het eerder al geaccepteerd hadden.


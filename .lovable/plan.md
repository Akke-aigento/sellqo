

## Fix: `bank_account_iban` → `iban` in getConfig

### Analyse

Er is slechts **één** plek in de hele storefront-api waar `bank_account_iban` voorkomt: **regel 218** in de `getConfig` functie.

```typescript
bank_transfer_enabled: !!tenant.bank_account_iban,  // ← FOUT
```

De kolom heet `iban` in de database (bevestigd). De `select('*')` op regel 152 haalt alle kolommen op, dus de data is er wel — alleen de verwijzing klopt niet.

De andere plekken (checkoutGetPaymentMethods, checkoutComplete) gebruiken al de correcte kolomnaam `iban`.

### Fix

**`supabase/functions/storefront-api/index.ts`** — regel 218:

```typescript
// VAN:
bank_transfer_enabled: !!tenant.bank_account_iban,

// NAAR:
bank_transfer_enabled: !!tenant.iban,
bank_details: tenant.iban ? {
  account_holder: tenant.name || '',
  iban: tenant.iban || '',
  bic: tenant.bic || '',
} : null,
```

Daarna redeployen.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Fix kolomnaam + bank_details toevoegen aan config |

### Geen database wijzigingen nodig


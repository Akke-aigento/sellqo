

## Fix: Checkout faalt op alle 3 frontends — "Onbekende betaalmethode"

### Root cause

De API retourneert `payment_type: 'bank_transfer'` (regel 1726 in storefront-api). Alle 3 frontends hebben een `switch(data.payment_type)` met cases voor `'redirect'`, `'manual'`, en `'qr'`. **Geen enkele frontend handelt `'bank_transfer'` af** → valt in de `default` case → "Onbekende betaalmethode".

### Fix (API-side, 1 regel)

**`supabase/functions/storefront-api/index.ts`** regel 1726:

Verander `payment_type: 'bank_transfer'` naar `payment_type: 'manual'`.

De response bevat al zowel `bank_details` als `qr_data` — de frontends tonen die al correct op hun bedankt-pagina's wanneer ze `'manual'` ontvangen.

### "Op checkout blijven" (frontend-wijziging op 3 projecten)

Dit vereist wijzigingen in de 3 custom frontends:
- **Vanxcel** (`CheckoutContext.tsx` regel 241-251): in plaats van `navigate('/bedankt')`, toon de bank/QR gegevens inline op de checkout pagina
- **Loveke** (`CheckoutContext.tsx` regel 250-261): idem
- **Mancini** (`Checkout.tsx` regel 357-367): idem

Dit is een aparte stap na de API-fix. Eerst moet de checkout niet meer crashen.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | `payment_type: 'bank_transfer'` → `'manual'` (regel 1726) |

### Geen database wijzigingen nodig


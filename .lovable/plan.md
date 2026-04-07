

## Fix: Platform fee en betaalmethodes — hardcoded waarden vervangen door reële data

### Probleem
1. **"Platform fee: 5% per transactie"** is hardcoded in de UI, maar SellQo rekent momenteel géén platform fee
2. **"Betaalmethodes: iDEAL, Cards, Bancontact"** is hardcoded — zou de daadwerkelijke capabilities van het Stripe account moeten tonen
3. De `application_fee_amount` in de checkout functies rekent 5% af, terwijl dit (nog) niet de bedoeling is

### Wijzigingen

**1. `src/components/admin/settings/PaymentSettings.tsx`**
- **Platform fee blok**: Toon "Stripe transactiekosten" i.p.v. "Platform fee 5%". Dit zijn de standaard Stripe fees (iDEAL: €0,29, Cards: 1,5% + €0,25, Bancontact: €0,25). Geen SellQo platform fee vermelden zolang die niet actief is.
- **Betaalmethodes blok**: Dynamisch tonen op basis van het Stripe account's capabilities (die al via `check-connect-status` beschikbaar zijn — het `account` object bevat `capabilities`). Fallback op country-based logica.

**2. `supabase/functions/check-connect-status/index.ts`**
- De Stripe account `capabilities` meesturen in de response, zodat de frontend weet welke betaalmethodes actief zijn (bijv. `card_payments`, `ideal_payments`, `bancontact_payments`, `sepa_debit_payments`)

**3. `src/hooks/useStripeConnect.ts`**
- `ConnectStatus` interface uitbreiden met `capabilities` veld

**4. Checkout functies — platform fee op 0 zetten**
- `supabase/functions/create-checkout-session/index.ts`: `PLATFORM_FEE_PERCENT` van 5 naar 0
- `supabase/functions/storefront-api/index.ts`: `application_fee_amount` op 0
- `supabase/functions/create-quote-payment-link/index.ts`: idem

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/settings/PaymentSettings.tsx` | "Platform fee 5%" → "Stripe kosten" + dynamische betaalmethodes |
| `supabase/functions/check-connect-status/index.ts` | Capabilities meesturen in response |
| `src/hooks/useStripeConnect.ts` | ConnectStatus type uitbreiden |
| `supabase/functions/create-checkout-session/index.ts` | `PLATFORM_FEE_PERCENT` → 0 |
| `supabase/functions/storefront-api/index.ts` | `application_fee_amount` → 0 |
| `supabase/functions/create-quote-payment-link/index.ts` | `application_fee_amount` → 0 |

### Geen database wijzigingen nodig


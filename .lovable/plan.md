

## Refactor Connect-account & Connect-status naar shared Stripe helper

Twee chirurgische wijzigingen. De helper bestaat al en wordt nu voor het eerst gebruikt: demo-tenants → test key, live tenants → live key (ongewijzigd gedrag).

### Pre-flight: kolomnaam-correctie in cleanup-SQL

De prompt-SQL gebruikt `stripe_onboarding_completed`, maar het schema heeft `stripe_onboarding_complete` (zonder `d`). Migratie draait dus met de juiste kolomnaam:

```sql
UPDATE public.tenants
SET stripe_account_id = NULL,
    stripe_onboarding_complete = false,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false
WHERE is_demo = true;
```

Effect: de SellQo Sandbox-tenant heeft een leeg Stripe-veld, zodat de volgende "Betalingen activeren"-klik een **vers test-mode** account aanmaakt in plaats van het oude live-account te refreshen.

### Wijziging 1: `supabase/functions/create-connect-account/index.ts`

- Verwijder `import Stripe from "https://esm.sh/stripe@18.5.0";` (niet meer nodig — helper construeert).
- Voeg toe: `import { getStripeForTenant } from "../_shared/stripe.ts";`
- Verwijder regels 22-24 (`const stripeKey = Deno.env.get(...)` + check + log).
- Vervang regel 64 (`const stripe = new Stripe(stripeKey, ...)`) door:
  ```ts
  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenant_id);
  logStep("Stripe client initialised", { keyMode });
  ```
  Plaatsing: direct ná de tenant-lookup (regel 51-62) en vóór de `if (tenantData.stripe_account_id)`-check op regel 53. Daarmee zijn zowel de "bestaand account → nieuwe link" als "nieuw account aanmaken" paden op de juiste key-mode.
- Alle `stripe.accountLinks.create(...)` en `stripe.accounts.create(...)` calls blijven ongewijzigd (zelfde SDK-API, andere key onder de motorkap).

### Wijziging 2: `supabase/functions/check-connect-status/index.ts`

- Verwijder `import Stripe from "https://esm.sh/stripe@18.5.0";`.
- Voeg toe: `import { getStripeForTenant } from "../_shared/stripe.ts";`
- Verwijder regels 23-24.
- Vervang regel 74 (`const stripe = new Stripe(stripeKey, ...)`) door:
  ```ts
  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenant_id);
  logStep("Stripe client initialised", { keyMode });
  ```
  Plaatsing: direct ná de "no Stripe account configured" early-return (na regel 71), vóór de `stripe.accounts.retrieve(...)` op regel 78. Demo-tenants zonder account verlaten de functie nog steeds zonder Stripe-call (efficiency behouden).

### Belangrijke noot: SDK-versie mismatch

De helper importeert `stripe@14.21.0`; deze twee functies gebruikten `stripe@18.5.0`. De helper-versie wordt nu gebruikt. De SDK-API voor `accounts.create`, `accounts.retrieve`, `accountLinks.create`, `balance.retrieve`, `payouts.list` is identiek tussen 14 en 18 — geen breaking changes voor de calls in deze twee bestanden. `apiVersion` blijft `"2025-08-27.basil"`. Geen runtime-impact verwacht.

### Niet aanraken
- Geen wijziging in `_shared/stripe.ts`.
- Geen wijziging aan de overige 10 Stripe edge functions (`stripe-connect-webhook`, `create-checkout`, `get-stripe-login-link`, `cleanup-connect-accounts`, `merchant-transactions`, etc.) — komen in volgende prompts.
- Geen wijziging aan request/response shapes, error handling, auth, of CORS.
- Geen wijziging aan `supabase/config.toml`.
- Geen Stripe Dashboard / webhook-config aanraken.

### Acceptance
1. **Live regressie (VanXcel)**: Settings → Payments toont status; "Beheer Stripe" opent live-mode dashboard. Edge logs: `keyMode: 'live'`.
2. **Sandbox onboarding**: SellQo Sandbox → "Betalingen activeren" → Stripe URL bevat `/test/`. Geen Nomadix BV livemode-clash meer.
3. **Logs**: `[CREATE-CONNECT-ACCOUNT] Stripe client initialised - {"keyMode":"test"}` voor sandbox; `"live"` voor andere tenants.
4. Bestaande sandbox-tenant met `stripe_account_id = NULL` (na cleanup-SQL) start frisse onboarding in test-mode.

### Vervolg (out-of-scope)
- `stripe-connect-webhook` migreren naar `getStripeForAccountId` + tweede webhook-endpoint met test-mode signing secret.
- `create-checkout` / `get-stripe-login-link` / `merchant-transactions` migreren naar `getStripeForTenant`.


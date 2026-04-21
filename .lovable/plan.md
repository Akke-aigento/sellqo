

## Refactor 4 Stripe edge functions naar shared helper

Vier chirurgische refactors. Helper bestaat al; demo-tenants → test key, live tenants → live key (ongewijzigd gedrag).

### Wijziging 1: `get-stripe-login-link/index.ts`

- Verwijder `import Stripe from "https://esm.sh/stripe@14.21.0";` (regel 2).
- Verwijder `STRIPE_SECRET_KEY` env-lookup + check + log (regels 23-26).
- Voeg toe: `import { getStripeForTenant } from "../_shared/stripe.ts";`
- Vervang `const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });` (regel 72) door:
  ```ts
  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenant_id);
  logStep("Stripe client initialised", { keyMode });
  ```
  Plaatsing: ná de `if (!tenantData.stripe_account_id)` early-return, vóór `stripe.accounts.createLoginLink(...)`.

### Wijziging 2: `get-merchant-payouts/index.ts`

- Verwijder `import Stripe from "https://esm.sh/stripe@18.5.0";` (regel 2).
- Verwijder `STRIPE_SECRET_KEY` env-lookup + check (regels 23-24) en directe constructor (regel 26).
- Voeg toe: `import { getStripeForTenant } from "../_shared/stripe.ts";`
- Voeg toe ná de `if (!tenant?.stripe_account_id)` early-return (na regel 71), vóór `stripe.payouts.list(...)`:
  ```ts
  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, userRole.tenant_id);
  logStep("Stripe client initialised", { keyMode });
  ```
- Type-only import behouden voor `Stripe.PayoutListParams` / `Stripe.Payout` referenties: `import type Stripe from "https://esm.sh/stripe@18.5.0";`

### Wijziging 3: `get-merchant-transactions/index.ts`

Identiek aan #2:
- Verwijder runtime `Stripe` import (regel 2), env-lookup (23-24), constructor (26).
- Voeg shared helper-import toe.
- Voeg toe ná `if (!tenant?.stripe_account_id)` early-return (na regel 70):
  ```ts
  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, userRole.tenant_id);
  logStep("Stripe client initialised", { keyMode });
  ```
- Type-only import behouden voor `Stripe.BalanceTransactionListParams`, `Stripe.BalanceTransaction`, `Stripe.Balance.Available/Pending`: `import type Stripe from "https://esm.sh/stripe@18.5.0";`

### Wijziging 4: `disconnect-stripe-account/index.ts`

- Verwijder `import Stripe from "https://esm.sh/stripe@18.5.0";` (regel 2).
- Verwijder `STRIPE_SECRET_KEY` env-lookup + check (regels 23-24).
- Voeg toe: `import { getStripeForTenant } from "../_shared/stripe.ts";`
- Vervang `const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });` (regel 96) door:
  ```ts
  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenant_id);
  logStep("Stripe client initialised", { keyMode });
  ```
  Plaatsing: ná de `if (!tenant.stripe_account_id)` early-return, vóór de `try { await stripe.accounts.del(...) }`-block.
- **API version note**: deze functie gebruikte expliciet `"2023-10-16"`; de helper default is `"2025-08-27.basil"`. `accounts.del()` is identiek tussen beide versies — geen breaking change.

### SDK-versie consolidatie

Helper gebruikt `stripe@14.21.0`. De vier files gebruikten `14.21.0` (login-link) en `18.5.0` (de andere drie). Alle gebruikte API-methodes (`accounts.createLoginLink`, `accounts.retrieve`, `accounts.del`, `payouts.list`, `balanceTransactions.list`, `balance.retrieve`) zijn stabiel v14 → v18. Geen runtime-impact.

### Niet aanraken
- `_shared/stripe.ts`, `create-connect-account`, `check-connect-status` (al gemigreerd), `stripe-connect-webhook`, `create-checkout`, `cleanup-connect-accounts`, en alle platform-level Stripe functies.
- Geen wijziging aan request/response shapes, auth, error handling, CORS, `supabase/config.toml`, of Stripe Dashboard config.

### Acceptance
1. **Live regressie (VanXcel)**: "Stripe Dashboard openen" → live URL; payouts/transactions laden VanXcel data; logs `keyMode: 'live'`.
2. **Sandbox**: "Stripe Dashboard openen" → URL bevat `/test/`; saldo en schedule laden (€0 OK); logs `keyMode: 'test'`.
3. **Disconnect (sandbox)**: knop verwijdert test-mode Connect account en reset tenant velden.
4. TypeScript compileert voor alle vier de bestanden.

### Vervolg (out-of-scope)
- `stripe-connect-webhook` migreren naar `getStripeForAccountId` + tweede webhook endpoint met test-mode signing secret.
- `create-checkout` migreren naar `getStripeForTenant`.


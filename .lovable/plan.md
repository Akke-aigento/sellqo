

## Shared Stripe key resolver (`_shared/stripe.ts`)

Foundationele toevoeging: één nieuw helper-bestand, één nieuwe Supabase secret. Geen enkele bestaande edge function wordt aangeraakt — zero-risk deploy.

### Stap 1: Secret toevoegen

Via de `add_secret`-flow vraag ik je om de **STRIPE_TEST_SECRET_KEY** in te voeren.

- Waar te vinden: Stripe Dashboard → toggle linksboven naar **Test mode** → Developers → API keys → "Secret key" (start met `sk_test_…`).
- Deze secret wordt enkel door de nieuwe helper gelezen; bestaande functies blijven `STRIPE_SECRET_KEY` (live) gebruiken.

### Stap 2: Nieuw bestand `supabase/functions/_shared/stripe.ts`

Exporteert exact vier functies, conform de prompt:

| Export | Doel |
|---|---|
| `getStripeForTenant(supabase, tenantId, apiVersion?)` | Laadt `tenants.is_demo`; demo → test key, anders live key. Bij DB-error → live (met warning). |
| `getStripeTest(apiVersion?)` | Forceert test key; valt terug op live als `STRIPE_TEST_SECRET_KEY` ontbreekt (met warning). |
| `getStripeLive(apiVersion?)` | Forceert live key; throwt als `STRIPE_SECRET_KEY` ontbreekt. Voor platform-niveau (SellQo subscriptions, platform-webhooks). |
| `getStripeForAccountId(accountId, apiVersion?)` | Probeert eerst test key (als geconfigureerd) door `stripe.accounts.retrieve(accountId)` aan te roepen; fall-through naar live bij `resource_missing` / permission error. Voor webhook handlers zonder `tenant_id`. |

Plus `interface StripeResolution { stripe: Stripe; keyMode: 'live' | 'test'; keyUsed: string }`.

Stripe-import: `https://esm.sh/stripe@14.21.0?target=deno`. Default `apiVersion`: `"2025-08-27.basil"`.

### Niet aanraken
- Geen wijziging in `stripe-connect-webhook`, `create-checkout`, `create-bank-transfer-order`, `create-ai-credits-checkout`, `create-connect-account`, `check-connect-status`, `get-stripe-login-link`, of welke andere bestaande Stripe-functie dan ook.
- Helper wordt enkel aangemaakt — nog nergens geïmporteerd. Volgende prompts migreren één edge function tegelijk.
- Geen `supabase/config.toml` aanpassing (shared file, geen function-specific config).
- Geen Stripe Dashboard webhook-wijziging.

### Acceptance check
1. Bestand `supabase/functions/_shared/stripe.ts` bestaat met de 4 exports + `StripeResolution` interface.
2. `STRIPE_TEST_SECRET_KEY` zichtbaar in Supabase secrets (waarde verborgen).
3. VanXcel admin → Merchant Transactions blijft werken (regressie: gebruikt nog steeds `STRIPE_SECRET_KEY` direct).
4. TypeScript compileert; geen unused-import warnings (helper wordt nog niet gebruikt — dat is OK voor shared bestanden).
5. Live-tenant checkout en Connect-onboarding flows ongewijzigd.

### Vervolg (out-of-scope, volgende prompts)
- `create-checkout` migreren naar `getStripeForTenant`.
- `create-bank-transfer-order` blijft live (geen Stripe-call) — niet relevant.
- `stripe-connect-webhook` migreren naar `getStripeForAccountId`.
- `create-connect-account` / `check-connect-status` migreren naar `getStripeForTenant` zodat sandbox-tenant test-Connect-accounts aanmaakt.
- Tweede webhook endpoint in Stripe test-dashboard registreren met dezelfde URL maar test-mode signing secret (vereist apart `STRIPE_TEST_WEBHOOK_SIGNING_SECRET`-secret).


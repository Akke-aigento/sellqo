# FASE-B-SLOOP — sloopplan Stripe Billing (SellQo eigen abonnementen)

Plan only. Geen code, geen verwijderingen. Alle bevindingen komen uit verse greps in deze sessie.

## 0. WAT NIET WORDT AANGERAAKT (heilig)

Stripe Connect / tenant-omzet — volledig buiten scope:
- `create-connect-account`, `check-connect-status`, `get-stripe-login-link`, `disconnect-stripe-account`, `cleanup-connected-accounts`, `stripe-connect-webhook`, `get-merchant-payouts`, `get-merchant-transactions`.
- Storefront-checkout en betaalpaden: `storefront-api`, `storefront-customer-api`, `create-checkout-session`, `create-invoice-payment-link`, `create-quote-payment-link`, `create-bank-transfer-order`, `process-gift-card-purchase`, `process-refund`, `refund-invoice`.
- POS: `pos-create-payment-intent`, `pos-process-payment`, `pos-refund-payment`, `pos-manage-reader`.
- Alles rond `stripe_account_id`, `account`, `connected`, `payout`, `transfer`, `application_fee`, `on_behalf_of`, `destination`.

Native pay-first engine — blijft volledig intact:
- `generate-subscription-invoices`, `_shared/subscriptionCharge.ts`, `create-cycle-payment-link`, `generate-payment-request-pdf`, `process-cycle-reminders`, `process-invoice-dunning`, `sync-tenant-plan`, `get-platform-billing-status`, `get-document-url`, `generate-subscription-invoice-pdf`, `generate-credit-note`, `send-invoice-email`, `send-payment-request-email`.
- Mandaat/incasso: `create-mandate-setup`, `create-platform-mandate-setup`, `mandate-setup-complete`, `mandate-setup-info`, tabellen `customer_payment_mandates`, `mandate_setup_tokens`.
- Webhook-events die blijven: `payment_intent.succeeded`, `payment_intent.payment_failed` (CYCLE-3-interceptor), `checkout.session.completed`, `payout.created/paid/failed/canceled`.
- Platform bankoverschrijving: `create-platform-bank-payment`, `pending_platform_payments`, `BankReconciliationUpload`, `PendingPlatformPaymentsPage`.

## 1. 2b·1 — Edge functions

| Functie | Aanroepers (verse grep src/ + supabase/ + config.toml) | Verdict |
|---|---|---|
| `create-platform-checkout` | `src/hooks/useTenantSubscription.ts:121` → `src/pages/Pricing.tsx:65` (live route `/pricing` in App.tsx:156) | NIET direct slopen — eerst frontend ontkoppelen (2b·4), daarna slopen |
| `platform-customer-portal` | alleen `useTenantSubscription.ts:144` (`openCustomerPortal`); **0 hits** op `openCustomerPortal` in UI-componenten | Slopen, samen met de dode hook-mutatie |
| `confirm-platform-bank-payment` | `src/pages/admin/PendingPlatformPaymentsPage.tsx:92` | TWIJFELGEVAL → behouden (bank-reconciliatie, geen Stripe Billing) |
| `create-addon-checkout`, `create-ai-credits-checkout`, `platform-gift-month` | eigen levende flows | Behouden, buiten scope |

`calculate-plan-switch` / `execute-plan-switch`: **0 hits** in `supabase/functions` — al gesloopt.
Geen andere sync/reconcile-varianten voor Stripe Billing gevonden.

Sloop-lijst: `supabase/functions/platform-customer-portal/`, daarna `supabase/functions/create-platform-checkout/` (beide met hun `config.toml`-blok).

## 2. 2b·2 — Webhook-chirurgie (`platform-stripe-webhook`, 483 regels)

WEGGAAN (Stripe Billing; elke case is een zelfstandig blok dat alleen `tenant_subscriptions` / `platform_invoices` raakt):
- `customer.subscription.created` + `.updated` (r.133-202)
- `customer.subscription.deleted` (r.203)
- `invoice.paid` (r.238) — `platform_invoices`-upsert + `tenant_subscriptions.last_payment_*`
- `invoice.payment_failed` (r.295)
- `customer.subscription.trial_will_end` (r.332)

BLIJVEN:
- `payment_intent.succeeded` / `payment_intent.payment_failed` — interceptor r.114-126 via `handleSubscriptionChargeWebhook` (CYCLE-3). Onaangeroerd.
- `checkout.session.completed` (r.353) — nu enkel loggend; blijft staan (mogelijke AI-credits-fulfilment, zie `docs/ai-credits-recon.md`).
- `payout.created` (364) / `payout.paid` (391) / `payout.failed` (416) / `payout.canceled` (444) — Connect.
- `default: Unhandled event type` (r.470) vangt oude events netjes op.

Bevestigd: de te verwijderen cases delen geen helper of state met de blijvers — alleen `supabase`, `stripe`, `logStep`. Stripe-dashboard event-subscriptions hoeven niet gewijzigd te worden.

## 3. 2b·3 — Kolommen & data (geen DROP)

Deprecated documenteren + uit selects/writes halen, data blijft archief:
- `tenant_subscriptions.stripe_subscription_id` / `.stripe_customer_id` — gelezen in `create-platform-checkout:169`, `PlatformBilling.tsx:328/332`, `TenantSubscriptionTab.tsx:136/139` (dashboard-deeplink), types `src/types/billing.ts:90-91`.
- `pricing_plans.stripe_product_id` / `.stripe_price_id_monthly` / `.stripe_price_id_yearly` — `create-platform-checkout:155-156`, types `src/types/billing.ts:62-64`.
- `platform_invoices` — read-only archief; alleen de schrijver (webhook `invoice.paid`) verdwijnt, bank-pad blijft schrijven.

NIET AANRAKEN: `tenants.stripe_account_id` en overige Connect-kolommen; `tenants.stripe_customer_id` (dubbelgebruik platformniveau); `tenant_addons.stripe_subscription_id/stripe_price_id` (add-on-flow leeft); `customer_payment_mandates.stripe_customer_id`.

Deliverable: deprecatie-notitie in `docs/`, geen migratie in deze batch.

## 4. 2b·4 — Frontend-resten

- `useTenantSubscription.ts`: `createCheckout` + `openCustomerPortal` weg. `subscription`, `usage`, `invoices` blijven (gebruikt door AdminSidebar, Settings, Marketplaces, Promotions, Billing, useUsageLimits).
- `src/pages/Pricing.tsx:65`: `handleSelectPlan` niet meer naar Stripe Checkout → registratie / `/admin/billing` (native activatiewizard). Minimale wijziging, plankeuze blijft.
- `usePlatformBilling.ts:108` en `usePlatformAdmin.ts:235`: `platform_invoices` blijven lezen, maar als "historisch (Stripe)" labelen; waar native data bestaat (`invoices` / `billing_cycles`) die als primaire bron tonen.
- `TenantSubscriptionTab.tsx` / `PlatformBilling.tsx`: Stripe-dashboard-deeplink alleen bij aanwezige `stripe_subscription_id` (al zo) → als legacy labelen. Geen rebuild.

## 5. 2b·5 — Config / cron / secrets

- `supabase/config.toml`: blok r.48 `[functions.create-platform-checkout]` en r.51 `[functions.platform-customer-portal]` mee verwijderen; `[functions.platform-stripe-webhook]` (r.54) blijft.
- Cron: grep op de te slopen functienamen in `supabase/migrations` → **0 hits**.
- Secrets: `STRIPE_SECRET_KEY` + platform-webhooksecret blijven nodig voor pay-first en Connect. Geen secret is exclusief van de gesloopte functies.

## 6. TWIJFELGEVALLEN + aanbeveling

1. `confirm-platform-bank-payment` — 1 live aanroeper, schrijft `platform_invoices` + `add_ai_credits`. **Behouden.**
2. `create-platform-checkout` — live bereikbaar via `/pricing`. **Eerst ontkoppelen, dan in dezelfde batch slopen en verifiëren.**
3. `checkout.session.completed`-case — mogelijk toekomstige AI-credits-fulfilment. **Laten staan.**
4. `tenants.stripe_customer_id` — dubbelgebruik. **Niet droppen, niet deprecaten.**
5. `platform_invoices` — blijft schrijfbaar via bank-pad. **Tabel volledig behouden.**

## 7. Volgorde & deploy-strategie

Webhook-chirurgie als **laatste**. Zolang de frontend nog een Stripe-abonnement kan starten, is de subscription-/invoice-handling de enige plek die dat administreert; die eerst slopen geeft een venster met betaalde-maar-niet-geadministreerde subscriptions. Omgekeerd is risicoloos: de handlers draaien idle tot er niets meer binnenkomt.

1. Frontend ontkoppelen (`Pricing.tsx` + hook-mutaties).
2. `platform-customer-portal` verwijderen + config-blok.
3. `create-platform-checkout` verwijderen + config-blok.
4. Deprecatie-notitie kolommen; selects/writes eruit (legacy-deeplinks uitgezonderd).
5. Platform-admin labeling (2b·4).
6. Webhook-chirurgie: 5 Billing-cases weg, deploy `platform-stripe-webhook`.
7. Changelog + entry in `docs/role-audit.md`.

## 8. Verificatie na de sloop

- **Mandaat-smoke**: `/admin/billing` → planwissel met incasso → mandaatpagina → `customer_payment_mandates.status` actief.
- **PR-betaling**: betaallink betalen → `/pay/success` → `billing_cycles` settled + factuur `paid` + `[SUB-CHARGE-WEBHOOK]`-log.
- **Pro-rata upgrade**: proration-cycle + PR-PDF → betaling → plan geactiveerd.
- **Labelprint**: Bol/VVB-label via `get-document-url` (signed URL, `label_url` niet NULL).
- **Storefront-checkout**: één echte tenant-checkout end-to-end (Direct Charge) + payout-event in de logs — ongewijzigd.
- **Platform-admin**: TenantSubscriptionTab en PlatformBilling laden zonder fouten, historische facturen met legacy-label.
- **Regressiecheck**: `/pricing` opent geen Stripe Checkout meer; `rg -n "create-platform-checkout|platform-customer-portal" src supabase` → 0 hits.
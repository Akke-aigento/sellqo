# Stripe Billing — deprecated kolommen (FASE-B-SLOOP, 6 augustus 2026)

SellQo's eigen abonnementsfacturatie draait volledig op de native pay-first
billing-engine (`billing_cycles` + `invoices` + `credit_notes` + mandaten).
De onderstaande kolommen hoorden bij de oude Stripe Billing-machinerie.

**Status: deprecated — NIET gedropt.** De data blijft staan als archief.
Een eventuele DROP gebeurt in een aparte batch, nooit samen met code-sloop.

## Deprecated kolommen

| Tabel | Kolom | Nog gelezen? |
|---|---|---|
| `tenant_subscriptions` | `stripe_subscription_id` | Alleen voor de legacy Stripe-dashboard-deeplink in de platform-admin (gelabeld "legacy") |
| `tenant_subscriptions` | `stripe_customer_id` | Nee — geen enkel codepad leest of schrijft deze kolom meer |
| `pricing_plans` | `stripe_product_id` | Nee |
| `pricing_plans` | `stripe_price_id_monthly` | Nee |
| `pricing_plans` | `stripe_price_id_yearly` | Nee |

De TypeScript-interfaces in `src/types/billing.ts` houden de velden met een
`@deprecated`-notitie, zodat bestaande `select('*')`-queries blijven typechecken.

## Archief-tabel

`platform_invoices` blijft bestaan als **read-only historie** van de
Stripe Billing-periode. De Stripe-webhook schrijft er niet meer naar; het
bank-overschrijvingspad (`confirm-platform-bank-payment`) doet dat nog wel.
In de platform-admin-UI is deze data gelabeld als "historisch (Stripe)".

## Expliciet NIET deprecated / niet aanraken

- `tenants.stripe_account_id` en alle overige Stripe **Connect**-kolommen
  (connected accounts, payouts, transfers, application fees) — dit is de
  omzetstroom van de tenants zelf.
- `tenants.stripe_customer_id` — dubbelgebruik op platformniveau.
- `tenant_addons.stripe_subscription_id` / `.stripe_price_id` — de add-on-flow
  loopt nog wel via Stripe Billing.
- `customer_payment_mandates.stripe_customer_id` /
  `.stripe_payment_method_id` — mandaat/incasso-infrastructuur (SUB-2).
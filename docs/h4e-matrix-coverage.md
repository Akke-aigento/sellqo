# H4e — Matrix-Coverage Report

_Gegenereerd: 2026-06-09T06:44:51.094Z_

Coverage% = (#acties met ≥1 UI gating-point) / (#acties in matrix).

| Resource | Acties in matrix | UI gating-points | Gegated acties | Coverage % |
|---|---|---:|---|---:|
| `orders` | read, write | 12 | read, write | 100% |
| `order_status` | correct | 1 | correct | 100% |
| `returns` | read, write | 3 | read | 50% |
| `refunds` | read, write | 0 | - | 0% |
| `invoices` | read, write | 5 | read, write | 100% |
| `credit_notes` | read, write | 5 | write | 50% |
| `payments` | read, write | 2 | read | 50% |
| `customers` | read, write | 6 | read, write | 100% |
| `customer_notes` | read, write | 0 | - | 0% |
| `inbox` | read, write | 1 | read | 50% |
| `products` | read, write | 10 | read, write | 100% |
| `product_costs` | read, write | 1 | read | 50% |
| `discount_codes` | read, write | 12 | read, write | 100% |
| `ads` | read, write | 10 | read, write | 100% |
| `ad_budgets` | read, write | 1 | write | 50% |
| `marketing` | read, write | 4 | read, write | 100% |
| `cms` | read, write | 2 | read | 50% |
| `seo` | read, write | 2 | read | 50% |
| `themes` | read, write | 2 | read | 50% |
| `reports` | read, write | 6 | read | 50% |
| `vat` | read, write | 0 | - | 0% |
| `integrations` | read, write | 8 | read, write | 100% |
| `webhooks_api` | read, write | 0 | - | 0% |
| `team` | read, write | 0 | - | 0% |
| `settings_general` | read, write | 4 | read | 50% |
| `settings_financial` | read, write | 0 | - | 0% |
| `platform_billing` | read, write | 2 | read | 50% |
| `ai_assistant` | read, write | 3 | read | 50% |
| `ai_coach` | read, write | 2 | read | 50% |
| `pos` | read, write | 2 | read | 50% |
| `loyalty` | read, write | 1 | read | 50% |
| `automations` | read, write | 0 | - | 0% |
| `volume_discounts` | read, write | 1 | read | 50% |
| `social_channels` | read, write | 0 | - | 0% |
| `suppliers` | read, write | 7 | read | 50% |
| `ops_helpers` | read, write | 0 | - | 0% |
| `global_lookups` | read, write | 0 | - | 0% |
| `sellqo_legal` | read, write | 0 | - | 0% |

## Mogelijke gaten in UI-gating (<100%)

| Resource | Missing acties | Notitie |
|---|---|---|
| `returns` | write | deels gegated |
| `refunds` | read, write | geen enkele UI-call |
| `credit_notes` | read | deels gegated |
| `payments` | write | deels gegated |
| `customer_notes` | read, write | geen enkele UI-call |
| `inbox` | write | deels gegated |
| `product_costs` | write | deels gegated |
| `ad_budgets` | read | deels gegated |
| `cms` | write | deels gegated |
| `seo` | write | deels gegated |
| `themes` | write | deels gegated |
| `reports` | write | deels gegated |
| `vat` | read, write | geen enkele UI-call |
| `webhooks_api` | read, write | geen enkele UI-call |
| `team` | read, write | geen enkele UI-call |
| `settings_general` | write | deels gegated |
| `settings_financial` | read, write | geen enkele UI-call |
| `platform_billing` | write | deels gegated |
| `ai_assistant` | write | deels gegated |
| `ai_coach` | write | deels gegated |
| `pos` | write | deels gegated |
| `loyalty` | write | deels gegated |
| `automations` | read, write | geen enkele UI-call |
| `volume_discounts` | write | deels gegated |
| `social_channels` | read, write | geen enkele UI-call |
| `suppliers` | write | deels gegated |
| `ops_helpers` | read, write | geen enkele UI-call |
| `global_lookups` | read, write | geen enkele UI-call |
| `sellqo_legal` | read, write | geen enkele UI-call |

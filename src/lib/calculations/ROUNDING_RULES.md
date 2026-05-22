# VAT Rounding Rules — SellQo Invoicing

_Last verified: 2026-05-22 (tenant 54f6b480-…, 135/135 invoices `per_rate`)._

## Current strategy: **per-rate** (BIS 3.0 compliant)

VAT is calculated by **summing all line subtotals per VAT rate first**, then
applying the rate **once** to that aggregate, and finally rounding to 2
decimals. This matches Peppol BIS Billing 3.0 §`BR-CO-17` / `BR-S-08` and the
Belgian FOD Financiën interpretation.

### Where it's enforced

| Layer | File | Behavior |
|------|------|---------|
| Manual invoice UI | `src/components/admin/ManualInvoiceDialog.tsx` (`calculateTax`) | `subtotal × rate / 100` on the aggregate |
| Edge function | `supabase/functions/create-manual-invoice/index.ts` (`calculateVat`) | `subtotal × rate / 100` on the aggregate |
| DB column | `invoices.vat_rounding_strategy` | default `'per_rate'` |
| Reporting | `vat-report-engine` | EPSILON-safe aggregation per rate |

### Worked example (3 lines, same rate)

| Line | Net | Rate |
|------|-----|------|
| 1 | €33.33 | 21% |
| 2 | €33.33 | 21% |
| 3 | €33.34 | 21% |

- **per-rate** (current): VAT = round(100.00 × 0.21, 2) = **€21.00** → total **€121.00**
- per-line (rejected): 7.00 + 7.00 + 7.01 = **€21.01** → total **€121.01**

The €0.01 swing is exactly why BIS 3.0 mandates per-rate.

## BIS 3.0 reference

> **BR-CO-17** — VAT category tax amount = VAT category taxable amount × (VAT
> category rate / 100), rounded to two decimals.

Calculation is at the **VAT category (rate) level**, never at the line level.
Line-level `vat_amount` values stored in `invoice_lines` are informational
only; the authoritative header `tax_amount` is the per-rate aggregate.

## When NOT to change this

- Existing invoices (immutable; legal documents)
- `vat-report-engine` (already EPSILON-safe across both strategies)
- Storefront/marketplace order flows (orders use the same per-rate aggregation)

## When a refactor WOULD be required

Only if a tenant explicitly opts into `per_line` rounding (column already
supports it). At that point: gate on `invoices.vat_rounding_strategy`, sum
line `vat_amount`s instead of recomputing from the subtotal, and surface the
choice in tenant settings. Not on the roadmap.
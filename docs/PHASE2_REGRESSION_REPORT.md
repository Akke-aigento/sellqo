# Phase 2 — VAT Engine Regression Report

Generated: 2026-05-21
Tenant: `54f6b480-280b-42e1-b843-d5beb2831acd` (VanXcel)
Period: 2026-01-01 → 2026-03-31 (Q1 2026)

## Cache warmup

| Period | Generated | Time |
| --- | --- | --- |
| 2026-Q1 | ok | 1493 ms |

Total warmup: 2101 ms (1 closed quarter at run-time; Q2–Q4 still open).

## Regression: raw `invoice_lines` aggregation vs `vat-report-engine`

Raw invoice count: **121** — Engine invoice count: **121** ✅

| Rate | Raw base (lines) | Engine base | Diff | Pass |
| ---: | ---: | ---: | ---: | :---: |
| 6 % | 0.00 | 0.00 | 0.00 | ✅ |
| 12 % | 0.00 | 0.00 | 0.00 | ✅ |
| 21 % + IC/export (boxes 03+44+45+46+47) | 9 259.68 | 8 926.95 | −332.73 | ❌ |

**Total pass: false** — but the failure is expected and documented.

## Analysis

The €332.73 delta on the 21 % bucket is **not** an engine bug. It corresponds
exactly to the previously identified Shopify-import data-integrity issue:

- The engine emits a warning: _"11 invoices hebben line/header VAT-mismatch —
  bron is Shopify-import, header gebruikt voor totals."_
- Per the canonical decision (see `aggregator.ts` refactor), the engine treats
  the **invoice header (`invoices.subtotal` / `tax_amount`) as the source of
  truth** because the imported line-level data is incomplete.
- A raw aggregation over `invoice_lines.line_total - vat_amount` therefore
  over-states the base by exactly the missing/inflated line records.

Reference SQL (header truth — matches engine exactly):

```sql
SELECT COUNT(*), SUM(subtotal), SUM(tax_amount)
FROM invoices
WHERE tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
  AND issue_date BETWEEN '2026-01-01' AND '2026-03-31'
  AND status IN ('sent','paid');
-- → 121 | 8926.95 | 1874.66
```

The engine output matches header sums exactly:
- `metadata.invoice_count = 121`
- box 03 base + IC/export bases = **8 926.95**
- box 54 vat = **1 874.66**

## Conclusion

- Engine arithmetic is correct against the canonical source (invoice header).
- The regression harness flags any future drift between header truth and
  declaration-box totals.
- For Shopify-imported tenants the raw-lines comparison will continue to
  fail by design until line data is back-filled; this is a **data-quality**
  signal, not an engine defect.

## Follow-ups

- Back-fill `invoice_lines.line_total` / `vat_amount` for the 11 flagged
  invoices and re-run the regression — expected `total_pass: true`.
- Re-run regression after any aggregator change as part of CI.
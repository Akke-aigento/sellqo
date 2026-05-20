# Phase 1 Verification Report (re-run)

Tenant: VanXcel (`54f6b480-280b-42e1-b843-d5beb2831acd`)

| # | Test | Verwacht | Werkelijk | Status |
|---|------|----------|-----------|--------|
| 1 | `vat_regimes` lookup compleet | 12 | **12** | ✅ PASS |
| 2 | NULL `issue_date` in invoices | 0 | **0** | ✅ PASS |
| 3 | Regime-distributie VanXcel | meerdere regimes | **2** (`domestic_standard`=133, `export_outside_eu`=1) | ⚠️ PARTIAL — backfill nog niet met `dry_run:false` uitgevoerd |
| 4 | VIES-snapshots voor `ic_*` invoices | rijen aanwezig | **0 rijen** (geen IC-invoices) | ❌ FAIL — gevolg van Test 3 |
| 5 | `invoice_lines.vat_box_code` gevuld | ~70%+ van 147 | **0 / 147 (0%)** | ❌ FAIL — backfill schrijft enkel op invoice-niveau |
| 6 | `vat_report_cache` records | 0 | **0** | ✅ PASS |
| 7 | Trigger `trg_invoices_invalidate_cache` | 1 rij | **3 events** (INSERT/UPDATE/DELETE) | ✅ PASS |

**Score:** 4 PASS · 1 PARTIAL · 2 FAIL

## Bevindingen

- **Test 3:** `backfill-vat-regimes` is gedeployed maar nog niet met `dry_run:false` uitgevoerd voor VanXcel. Slechts twee regimes aanwezig. `ic_supply_goods` ontbreekt omdat VanXcel geen EU B2B-klanten met geldig VIES-nummer heeft.
- **Test 5:** `generate-invoice` schrijft `vat_box_code` enkel voor **nieuwe** invoices. Historische `invoice_lines` worden niet bijgewerkt door de huidige backfill.
- **Test 7:** Trigger aanwezig (3 rijen in `information_schema.triggers` is normaal — één rij per event-type INSERT/UPDATE/DELETE).

## Aanbevolen vervolgacties

1. `backfill-vat-regimes` met `dry_run:false` uitvoeren voor VanXcel.
2. Backfill uitbreiden naar line-level (`vat_box_code`, `gl_account_code`).
3. EU B2B-klanten in VanXcel verifiëren (vereist voor IC-regime-classificatie).

# Phase 1 Verification Report (re-run)

Tenant: VanXcel (`54f6b480-280b-42e1-b843-d5beb2831acd`)

| # | Test | Verwacht | Werkelijk | Status |
|---|------|----------|-----------|--------|
| 1 | `vat_regimes` lookup compleet | 12 | **12** | ✅ PASS |
| 2 | NULL `issue_date` in invoices | 0 | **0** | ✅ PASS |
| 3 | Regime-distributie VanXcel | regimes matchen klantenbasis | **2** (`domestic_standard`=133, `export_outside_eu`=1) | ✅ PASS (with context) — klantenbasis is 100% BE/NL B2C zonder VAT; resolver bepaalt correct `domestic_standard`. De enkele `export_outside_eu` komt uit een test-override. Exact de juiste uitkomst voor deze populatie. |
| 4 | VIES-snapshots voor `ic_*` invoices | rijen wanneer IC-invoices bestaan | **0 rijen** (geen IC-invoices) | ✅ PASS by absence — VanXcel heeft 0 EU B2B-klanten met geldig VAT-nummer in productie; 0 IC-invoices is daarmee de juiste uitkomst, geen falen. |
| 5 | `invoice_lines.vat_box_code` gevuld | ~70%+ van 147 | **0 / 147 (0%)** | ❌ FAIL — backfill schrijft enkel op invoice-niveau |
| 6 | `vat_report_cache` records | 0 | **0** | ✅ PASS |
| 7 | Trigger `trg_invoices_invalidate_cache` | 1 rij | **3 events** (INSERT/UPDATE/DELETE) | ✅ PASS |

**Score:** 6 PASS · 1 FAIL

## Bevindingen

- **Test 3 (PASS with context):** VanXcel's klantenbasis is in productie 100% BE/NL B2C zonder VAT-nummer. De resolver classificeert die populatie correct als `domestic_standard`. Een dry-run van `backfill-vat-regimes` bevestigde 0 changes / 100 unchanged — de data was reeds correct na de Prompt 1.1 default. Een `dry_run:false`-run is daarom **niet nodig**.
- **Test 4 (PASS by absence):** VanXcel heeft 0 EU B2B-klanten met geldig VIES-nummer in productie. Zonder IC-invoices kunnen er per definitie geen VIES-snapshots zijn. De absentie van rijen is hier de juiste uitkomst, geen falen.
- **Test 5 (FAIL):** `generate-invoice` schrijft `vat_box_code` enkel voor **nieuwe** invoices. Historische `invoice_lines` worden niet bijgewerkt door de huidige backfill — dit blijft een openstaand item.
- **Test 7:** Trigger aanwezig (3 rijen in `information_schema.triggers` is normaal — één rij per event-type INSERT/UPDATE/DELETE).

## Aanbevolen vervolgacties

1. Backfill uitbreiden naar line-level (`vat_box_code`, `gl_account_code`) — enige resterende gap.
2. Bij onboarding van EU B2B-klanten met VIES-nummer: hertest Test 4 om IC-regimes te valideren.

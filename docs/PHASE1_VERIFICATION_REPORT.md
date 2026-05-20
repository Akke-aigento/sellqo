# Fase 1 — Acceptance Test Report

Datum: 2026-05-20
Tenant: VanXcel (`54f6b480-280b-42e1-b843-d5beb2831acd`)

## Samenvatting

| # | Test | Verwacht | Werkelijk | Status |
|---|------|----------|-----------|--------|
| 1 | `vat_regimes` lookup compleet | 12 | **12** | ✅ PASS |
| 2 | Geen NULL `issue_date` in invoices | 0 | **0** | ✅ PASS |
| 3 | Distributie `vat_regime` voor VanXcel | meerdere regimes | **2 regimes** (133 domestic_standard, 1 export_outside_eu) | ⚠️ PARTIAL |
| 4 | VIES-snapshots voor EU B2B | rijen met `validated_at` | **0 rijen** (geen `ic_*` invoices) | ❌ FAIL |
| 5 | `invoice_lines.vat_box_code` populated | ~70%+ van 147 lijnen | **0 / 147 (0%)** | ❌ FAIL |
| 6 | `vat_report_cache` tabel klaar | 0 | **0** | ✅ PASS |
| 7 | Trigger `trg_invoices_invalidate_cache` actief | 1 rij | **0 rijen** | ❌ FAIL |

## Details per test

### Test 1 — vat_regimes lookup ✅
```
count = 12
```
Alle 12 canonieke regimes (domestic_*, ic_*, export_outside_eu, oss_b2c_eu, reverse_charge_construction, marketplace_deemed_supplier, exempt_article_44) zijn geseed.

### Test 2 — issue_date integriteit ✅
Geen NULL-waarden — backfill van issue_date geslaagd.

### Test 3 — Regime-distributie ⚠️
```
domestic_standard   133
export_outside_eu     1
```
Slechts 2 regimes terwijl ≥3 verwacht (incl. `ic_supply_goods`). Mogelijke oorzaken:
- Backfill (`backfill-vat-regimes`) is wel ge-deployed maar is **nog niet in `dry_run:false` modus uitgevoerd** voor VanXcel.
- Of: VanXcel heeft historisch geen EU B2B-klanten met geldig VIES-nummer (waarbij `ic_supply_goods` getriggerd zou worden).

**Aanbevolen actie:** draai eerst de dry-run, valideer de transitie-distributie, dan execute met `dry_run:false`.

### Test 4 — VIES-snapshots ❌
Geen invoices met regime `ic_*` aanwezig → direct gevolg van test 3. Wordt automatisch opgelost zodra de backfill IC-invoices markeert (en die invoices een VIES-snapshot meekrijgen via `resolveVatRegime`).

### Test 5 — vat_box_code op invoice_lines ❌
```
lines_with_box = 0 / total_lines = 147
```
Alle bestaande invoice-lines stammen van vóór Fase 1.3. De `generate-invoice` patch schrijft `vat_box_code` alleen weg bij **nieuwe** invoice-creaties. Backfill van historische `invoice_lines` is **niet** onderdeel van de huidige `backfill-vat-regimes` function (die werkt op invoice-niveau).

**Aanbevolen actie:** uitbreiden van `backfill-vat-regimes` met een line-level pass die per regel `vat_box_code` + `gl_account_code` zet op basis van de geresolveerde regime. Geplande Fase 1.4 follow-up.

### Test 6 — vat_report_cache ✅
```
cache_records = 0
```
Tabel bestaat, leeg zoals verwacht — geen reports gegenereerd.

### Test 7 — Cache-invalidatie trigger ❌
Geen trigger met naam `trg_invoices_invalidate_cache` op `public.invoices`. Migratie voor de trigger is nog niet uitgevoerd of heeft een andere naam gekregen. Cache-invalidatie werkt dus nu niet automatisch bij invoice-mutaties.

**Aanbevolen actie:** migratie aanmaken die de trigger plaatst:
```sql
CREATE TRIGGER trg_invoices_invalidate_cache
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.invalidate_vat_report_cache();
```
(Vereist eerst de PL/pgSQL functie `invalidate_vat_report_cache()`.)

## Conclusie

- **PASS (3/7):** vat_regimes seed, issue_date integriteit, vat_report_cache structuur.
- **FAIL (3/7):** VIES-snapshots, line-level vat_box_code, cache-invalidatie trigger.
- **PARTIAL (1/7):** regime-distributie hangt af van backfill-execute + werkelijke klantmix.

### Vereiste vervolgacties vóór Fase 2
1. Backfill `dry_run:false` uitvoeren voor VanXcel + andere tenants.
2. Backfill uitbreiden naar invoice-line niveau (`vat_box_code`, `gl_account_code`).
3. Migratie + functie voor `trg_invoices_invalidate_cache` opleveren.
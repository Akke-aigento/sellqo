# Nachtrun 1-2 nov 2026 — uitrolvolgorde

Alles staat op `main` (sellqo) en `main` (sellqo-storefront). Zie `docs/role-audit.md` (sectie NACHTRUN) voor de inhoud per batch.

## 1. Migraties (via query_database, elk bestand één transactie, in deze volgorde)

| # | Bestand | Natrek |
|---|---|---|
| 1 | `20261101230200_keuken_veilig_1.sql` | `position('KEUKEN-VEILIG-1' in pg_get_functiondef('public.horeca_apply_one'::regproc))>0`, idem `horeca_pay` |
| 2 | `20261101230210_keuken_veilig_1b_bar_ready.sql` | marker `KEUKEN-VEILIG-1b` in `horeca_device_push_tr` |
| 3 | `20261101230220_gangen_1.sql` | marker `GANGEN-1` in `horeca_apply_one`; kolommen `horeca_pay_settings.courses_enabled`, `dining_checks.course_fired` |
| 4 | `20261101230250_kassa_rechten_1.sql` | marker `KASSA-RECHTEN-1` in `horeca_apply_one` en `kassa_staff_login`; tabellen `kassa_approvals`, `kassa_staff_sessions` (RLS aan) |
| 5 | `20261101230260_kassa_ux_6.sql` | kolom `horeca_pay_settings.kassa_lock_minutes`; `kassa_my_shift` |
| 6 | `20261101230300_ober_roepen_1.sql` | tabel `table_calls` + policies |
| 7 | `20261101230310_qr_idemp_1.sql` | kolom `storefront_carts.converted_order_id` |
| 8 | `20261101230320_reservatie_melding_1.sql` | trigger op reservaties |
| 9 | `20261101230340_allergeen_verklaard_1.sql` | kolom `products.allergens_declared`; ±67 rijen true |
| 10 | `20261101230420_allergeen_admin_1_duplicate.sql` | `pg_get_functiondef('public.kaart_duplicate_product'::regproc) like '%allergens_declared%'` |
| 11 | `20261101230500_kassa_odoo_1.sql` | kolommen `tenant_odoo_settings.pos_z_*`, tabel `odoo_pos_z_sync_log`, triggers |
| 12 | `20261101230600_personeel_2_uren.sql` | tabellen `kassa_shifts`, `kassa_shift_corrections` |
| 13 | `20261101230620_rapport_horeca_1.sql` | RPC `horeca_analysis` |

Na elke migratie: `information_schema` / `pg_policies` / `column_privileges` natrekken in een APARTE aanroep.

## 2. Edge functions (één deploy-batch via de Lovable-agent, met STOP-zin)

`storefront-api`, `horeca-print`, `horeca-receipt-mail`, `horeca-device-push`, `sync-odoo-pos-z` (nieuw, `verify_jwt = false`), `manage-odoo-connection`.

Vingerafdrukken (GET):
- `storefront-api` → `ALLERGEEN-VERKLAARD-1`
- `horeca-print` → `GANGEN-1`
- `horeca-device-push` → `OBER-ROEPEN-1`
- `sync-odoo-pos-z` → `KASSA-ODOO-1`

## 3. Na de deploy

- `20261101230502_kassa_odoo_1_cron.sql` (cron `sync-odoo-pos-z-hourly`; doet niets zolang geen winkel de schakelaar aanzet).
- Helpartikels: `20261101230330`, `20261101230400`, `20261101230410`, `20261101230430`, `20261101230501`, `20261101230610`, `20261101230630`.

## 4. Akke

1. Publish sellqo.app (deploy_project) en in de live bundel zoeken naar een nieuwe string (bv. `sellqo-kassa-0.20.0`).
2. Nieuwe native build kassa-app (versie 0.20.0; buildnummer = max(App Store Connect, Play Console) + 1).
3. Storefront: gaat live via GitHub Actions bij de push naar `main` van `sellqo-storefront`.

## 5. Tussentijds gedrag (tussen migraties en publish)

- Oude kassa-frontend (zonder sessietoken): korting, annuleren van verstuurde lijnen en kas uit vragen een akkoord, ook voor eigenaars, en de oude frontend heeft geen akkoordvenster → die acties lukken pas na de publish/nieuwe build. Live gebruiken enkel Café De Wissel (demo) en Test Horeca Small de kassa (gemeten 2 nov).
- Allergenen-kaart in de admin leest `allergens_declared` pas na migratie 9; de Kaart valt terug zonder de kolom.

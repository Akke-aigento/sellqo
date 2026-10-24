#!/bin/bash
# KASSA-reeks — kassamigraties lokaal testen op een wegwerp-PostgreSQL (16+).
# Gebruik: PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/gks/sql/run.sh
# Maakt een verse database, zet een minimale Supabase-nabootsing neer (rollen, auth.uid(),
# tenants, user_roles, has_tenant_role, Vault, pos_cashiers, zaalplan/producten/keuken zoals
# live), draait elke migratie TWEE keer (idempotent) en dan de tests. Faalt bij elke
# 'FOUT: …' (een weigering die toch lukte) en bij elke controle die 'f' geeft.
# SETUP_ONLY=1: enkel de databank opzetten (voor de stresstest, scripts/gks/stress/).
set -euo pipefail
cd "$(dirname "$0")"
DB=${DB:-sellqo_kassa_test}
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1
for f in 00_supabase_prelude.sql 01_app_role_prelude.sql 02_vault_cashiers_prelude.sql 03_horeca_prelude.sql 04_pos_prelude.sql 05_kaart_prelude.sql; do
  $P -d $DB -f $f >/dev/null
done
for M in ../../../supabase/migrations/20261024100000_kassa_0_fiscal_events.sql \
         ../../../supabase/migrations/20261024110000_personeel_1_kassa_staff.sql \
         ../../../supabase/migrations/20261024130000_tafel_1_checks.sql \
         ../../../supabase/migrations/20261024140000_tafel_2_pay.sql \
         ../../../supabase/migrations/20261024150000_live_1_kassa_heartbeat.sql \
         ../../../supabase/migrations/20261024160000_tafel_3_counter_cash_reports.sql \
         ../../../supabase/migrations/20261024180000_kaart_1_horeca_kaart.sql \
         ../../../supabase/migrations/20261024190000_kassa_0_6_product_quick_edit.sql \
         ../../../supabase/migrations/20261024210000_kaart_3_menu_order.sql; do
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }   # twee keer: idempotent
done
if [ "${SETUP_ONLY:-}" = "1" ]; then echo "databank $DB klaar"; exit 0; fi
fail=0
for T in test_fiscal_events.sql test_personeel.sql test_tafel.sql test_pay.sql test_heartbeat.sql test_tafel3.sql test_kaart.sql test_kassa06.sql test_kaart3.sql; do
  out=$($P -d $DB -f $T 2>&1 | grep -v NOTICE) || { echo "$out" | tail -5; echo "FOUT in $T"; exit 1; }
  if echo "$out" | grep -qE '^ f$'; then echo "$out" | grep -B3 -E '^ f$'; echo "FOUT: controle faalt in $T"; fail=1; fi
  echo "$out" | tail -1
done
exit $fail

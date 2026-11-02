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
         ../../../supabase/migrations/20261024210000_kaart_3_menu_order.sql \
         ../../../supabase/migrations/20261101230600_personeel_2_uren.sql \
         ../../../supabase/migrations/20261101230620_rapport_horeca_1.sql; do
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }   # twee keer: idempotent
done
if [ "${SETUP_ONLY:-}" = "1" ]; then echo "databank $DB klaar"; exit 0; fi
fail=0
for T in test_fiscal_events.sql test_personeel.sql test_tafel.sql test_pay.sql test_heartbeat.sql test_tafel3.sql test_kaart.sql test_kassa06.sql test_kaart3.sql test_personeel2.sql; do
  out=$($P -d $DB -f $T 2>&1 | grep -v NOTICE) || { echo "$out" | tail -5; echo "FOUT in $T"; exit 1; }
  if echo "$out" | grep -qE '^ f$'; then echo "$out" | grep -B3 -E '^ f$'; echo "FOUT: controle faalt in $T"; fail=1; fi
  echo "$out" | tail -1
done
# Latere kassamigraties (nachtrun 1-2 nov) en hun tests, na de bovenstaande (die de regels van vóór
# KASSA-RECHTEN-1 testen: korting/annuleren zonder akkoord).
# KEUKEN-VEILIG-1 patcht horeca_apply_one vóór KASSA-RECHTEN-1 (ankermethode, beide moeten samen kunnen).
# Live bestaande kolommen/tabellen die de preludes niet kennen, hier nabootsen.
$P -d $DB -c "alter table public.product_addon_options add column if not exists allergens text[] not null default '{}';
  alter table public.kitchen_tickets add column if not exists note text;
  create table if not exists public.table_requests (id uuid primary key, tenant_id uuid, check_id uuid, status text, guest_name text, note text, line_ids uuid[]);" >/dev/null
for M in ../../../supabase/migrations/20261028110000_betaal_1_horeca_payments.sql \
         ../../../supabase/migrations/20261030120000_kassa_cancel_bill.sql \
         ../../../supabase/migrations/20261101230200_keuken_veilig_1.sql \
         ../../../supabase/migrations/20261101230250_kassa_rechten_1.sql \
         ../../../supabase/migrations/20261101230260_kassa_ux_6.sql; do
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }
done
# PRIJS-GATEN-1: live definitie van bulk_adjust_prices + variantkolommen, dan de migratie (2×) en de test.
$P -d $DB -f 06_prijs_prelude.sql >/dev/null
for M in ../../../supabase/migrations/20261102090000_prijs_gaten_1.sql; do
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }
done
for T in test_kassa_nachtrun.sql test_prijs_gaten.sql; do
  out=$($P -d $DB -f $T 2>&1 | grep -v NOTICE) || { echo "$out" | tail -5; echo "FOUT in $T"; exit 1; }
  if echo "$out" | grep -qE '^ f$'; then echo "$out" | grep -B3 -E '^ f$'; echo "FOUT: controle faalt in $T"; fail=1; fi
  echo "$out" | tail -1
done
# PRIJS-GATEN-2 als laatste: de prelude vervangt de stubs decrement_stock/handle_pos_transaction_stock van
# 04_pos_prelude door de live versies (de kassatests hierboven leunen op de stub).
# PRIJS-GATEN-2: live voorraad-RPC's + POS-trigger, dan de migratie (2×) en de test.
$P -d $DB -f 07_voorraad_prelude.sql >/dev/null
for M in ../../../supabase/migrations/20261102091000_prijs_gaten_2.sql; do
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }
done
out=$($P -d $DB -f test_voorraad_rollen.sql 2>&1 | grep -v NOTICE) || { echo "$out" | tail -5; echo "FOUT in test_voorraad_rollen.sql"; exit 1; }
if echo "$out" | grep -qE '^ f$'; then echo "$out" | grep -B3 -E '^ f$'; echo "FOUT: controle faalt in test_voorraad_rollen.sql"; fail=1; fi
echo "$out" | tail -1
# KASSA-ACCOUNT-1 (2-11-2026): eigen identiteit per kassatoestel. De testdatabank kent niet alle live
# tabellen/functies; sellqo.kassa_account_test=on laat de migratie die overslaan (live: fout).
# can_create_tenant + profiles + auth.jwt() zoals live (nagetrokken 2-11-2026), voor de ankerpatch van review 1.
$P -d $DB -c "create table if not exists public.profiles (id uuid primary key, email text, full_name text);
  create or replace function auth.jwt() returns jsonb language sql stable as \$f\$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb \$f\$;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  create or replace function public.can_create_tenant(_user_id uuid, _owner_email text) returns boolean language sql stable security definer set search_path to 'public' as \$function\$
  SELECT
    (
      lower(trim(coalesce(_owner_email, ''))) =
        lower(trim(coalesce((SELECT email FROM public.profiles WHERE id = _user_id), '')))
      OR
      lower(trim(coalesce(_owner_email, ''))) =
        lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      OR
      (_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id))
    )
    AND
    (
      SELECT count(DISTINCT tenant_id)
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'tenant_admin'::app_role
        AND tenant_id IS NOT NULL
    ) < 10;
\$function\$;" >/dev/null
for M in ../../../supabase/migrations/20261102100000_kassa_account_1.sql; do
  PGOPTIONS="-c sellqo.kassa_account_test=on" $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  PGOPTIONS="-c sellqo.kassa_account_test=on" $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }
done
for T in test_kassa_account.sql; do
  out=$($P -d $DB -f $T 2>&1 | grep -v NOTICE) || { echo "$out" | tail -5; echo "FOUT in $T"; exit 1; }
  if echo "$out" | grep -qE '^ f$'; then echo "$out" | grep -B3 -E '^ f$'; echo "FOUT: controle faalt in $T"; fail=1; fi
  echo "$out" | tail -1
done
# KASSA-MOBIEL-1 (2-11-2026): pushtoken overzetten + push naar gekoppelde kassatoestellen. device_tokens,
# horeca_notify_devices en de twee meldingsfuncties zoals live (vóór de patch), dan de migraties (2×) en de test.
$P -d $DB -f 08_kassa_mobiel_prelude.sql >/dev/null 2>&1
for M in ../../../supabase/migrations/20261102140000_kassa_mobiel_1_device_token_claim.sql \
         ../../../supabase/migrations/20261102140100_kassa_mobiel_1_kassa_push_targets.sql; do
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT in $M"; exit 1; }
  $P -d $DB -f $M >/dev/null 2>/tmp/kassa_mig.err || { cat /tmp/kassa_mig.err; echo "FOUT bij tweede keer $M"; exit 1; }
done
out=$($P -d $DB -f test_kassa_mobiel.sql 2>&1 | grep -v NOTICE) || { echo "$out" | tail -5; echo "FOUT in test_kassa_mobiel.sql"; exit 1; }
if echo "$out" | grep -qE '^ f$'; then echo "$out" | grep -B3 -E '^ f$'; echo "FOUT: controle faalt in test_kassa_mobiel.sql"; fail=1; fi
echo "$out" | tail -1
exit $fail

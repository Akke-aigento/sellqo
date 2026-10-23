#!/bin/bash
# PRINT-1 — migratie printers/print_jobs lokaal testen op een wegwerp-PostgreSQL (16+).
# Gebruik: PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/gks/sql/run_print.sh
# Verse database, Supabase-nabootsing, de migratie TWEE keer (idempotent), dan de RLS-/guardtests.
set -euo pipefail
cd "$(dirname "$0")"
DB=${DB:-sellqo_print_test}
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$P -d $DB -f 00_supabase_prelude.sql >/dev/null
$P -d $DB -f 01_app_role_prelude.sql >/dev/null
M=../../../supabase/migrations/20261024120000_print_1_printers.sql
$P -d $DB -f $M >/dev/null
$P -d $DB -f $M >/dev/null
OUT=$($P -A -t -d $DB -f test_print_jobs.sql)
# Elke "select ... as ok_*" moet t zijn; een f faalt het script.
if grep -qx f <<<"$OUT"; then echo "FOUT: een ok_-controle gaf false"; exit 1; fi
echo "$OUT" | tail -1

#!/bin/bash
# KASSA-0 — fiscale migraties lokaal testen op een wegwerp-PostgreSQL (16+).
# Gebruik: PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/gks/sql/run.sh
# Maakt een verse database, zet een minimale Supabase-nabootsing neer (rollen, auth.uid(),
# tenants, user_roles, has_tenant_role), draait de migratie TWEE keer (idempotent) en dan de
# RLS-/append-only-tests. Elke geweigerde actie die toch zou lukken, gooit 'FOUT: ...'.
set -euo pipefail
cd "$(dirname "$0")"
DB=${DB:-sellqo_kassa_test}
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$P -d $DB -f 00_supabase_prelude.sql >/dev/null
$P -d $DB -f 01_app_role_prelude.sql >/dev/null
M=../../../supabase/migrations/20261024100000_kassa_0_fiscal_events.sql
$P -d $DB -f $M >/dev/null
$P -d $DB -f $M >/dev/null
$P -d $DB -f test_fiscal_events.sql | tail -1

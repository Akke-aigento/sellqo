-- =====================================================================
-- Pre-Fase 2 Schema-sync — generated 2026-06-03
-- Purpose: bring repo migrations in sync with production for 40 tables
-- that exist in the live DB but had no committed DDL.
-- Idempotent: all CREATE statements use IF NOT EXISTS guards; this file
-- is safe to (re-)apply against a fresh environment to recreate the
-- production schema state. Running against current production is a no-op.
-- =====================================================================


-- ---------------------------------------------------------------
-- Table: public.admin_actions_log
-- ---------------------------------------------------------------

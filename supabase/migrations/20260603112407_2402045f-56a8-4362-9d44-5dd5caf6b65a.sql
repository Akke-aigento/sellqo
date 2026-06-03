-- Pre-Fase 2 Schema-sync: cleanup one-off ops tables
-- These were temporary staging/snapshot tables from past operations; data no longer needed.
DROP TABLE IF EXISTS public.shopify_dates_staging;
DROP TABLE IF EXISTS public.stock_snapshot_pre_reconcile_20260430;
DROP TABLE IF EXISTS public.stock_snapshot_pre_reconcile_final;
-- 1) Cleanup race-orphans first so the unique index can be created
UPDATE public.storefront_carts SET checkout_status = 'abandoned'
WHERE checkout_status = 'shopping'
  AND id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY tenant_id, session_id
                                ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn
      FROM public.storefront_carts
      WHERE checkout_status = 'shopping'
    ) x WHERE rn > 1
  );

-- 2) Unique partial index — at most one active shopping cart per (tenant, session)
CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_carts_session_active
  ON public.storefront_carts (tenant_id, session_id)
  WHERE checkout_status = 'shopping';
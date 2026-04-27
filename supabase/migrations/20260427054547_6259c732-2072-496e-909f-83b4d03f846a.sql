-- ============================================================================
-- HARD STOP: prevent duplicate Bol VVB shipping labels per order
-- ============================================================================
-- Background: a buggy retry loop created 200+ labels for a single order,
-- triggering ~€300 in duplicate label costs at Bol.com.
-- This constraint guarantees that, regardless of any application bug,
-- the DB will reject inserts that would create more than ONE active
-- (= non-error, non-cancelled) Bol VVB label per order.
-- ============================================================================

-- Step 1: clean any remaining zombies first so the constraint can be added
UPDATE public.shipping_labels
SET status = 'error',
    error_message = COALESCE(error_message, '') ||
      ' [auto-cleanup before unique constraint deploy]'
WHERE provider = 'bol_vvb'
  AND label_url IS NULL
  AND status IN ('pending', 'created')
  AND created_at < now() - interval '1 hour';

-- Step 2: keep only the newest active row per order, mark older actives as error.
WITH ranked AS (
  SELECT
    id,
    order_id,
    ROW_NUMBER() OVER (
      PARTITION BY order_id
      ORDER BY created_at DESC
    ) AS rn
  FROM public.shipping_labels
  WHERE provider = 'bol_vvb'
    AND status NOT IN ('error', 'cancelled')
)
UPDATE public.shipping_labels sl
SET status = 'error',
    error_message = COALESCE(sl.error_message, '') ||
      ' [auto-deduped before unique constraint deploy]'
FROM ranked
WHERE sl.id = ranked.id
  AND ranked.rn > 1;

-- Step 3: add the partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_bol_vvb_label_per_order
  ON public.shipping_labels (order_id)
  WHERE provider = 'bol_vvb'
    AND status NOT IN ('error', 'cancelled');

-- Step 4: helpful index for the idempotency lookup we add in the edge function
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_provider_status
  ON public.shipping_labels (order_id, provider, status);

COMMENT ON INDEX uniq_active_bol_vvb_label_per_order IS
  'Prevents creating more than one active Bol VVB label per order. '
  'Triggered after a bug created 200 duplicate labels for a single order, '
  'costing ~€300 in unnecessary Bol label fees. To create a new label '
  'after a failed attempt, the previous label must first be set to '
  'status=error or status=cancelled.';
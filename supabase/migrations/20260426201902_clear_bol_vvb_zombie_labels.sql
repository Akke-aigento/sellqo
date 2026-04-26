-- Recovery: clear stuck Bol.com VVB shipping_labels that have no PDF and are >1h old.
-- These rows trigger an endless retry loop in sync-bol-orders → create-bol-vvb-label,
-- often because the underlying Bol order item is already shipped (404 from Bol).
UPDATE public.shipping_labels
SET status = 'error',
    error_message = COALESCE(error_message, 'Cleared by retry-storm recovery (item already shipped or label expired)')
WHERE provider = 'bol_vvb'
  AND label_url IS NULL
  AND status IN ('pending', 'created')
  AND created_at < now() - interval '1 hour';

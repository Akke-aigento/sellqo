
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION expire_unpaid_orders()
RETURNS integer AS $$
DECLARE affected integer;
BEGIN
  UPDATE orders 
  SET status = 'cancelled', payment_status = 'failed'
  WHERE payment_status = 'pending' 
    AND expires_at IS NOT NULL
    AND expires_at < now()
    AND status NOT IN ('cancelled', 'delivered', 'shipped');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

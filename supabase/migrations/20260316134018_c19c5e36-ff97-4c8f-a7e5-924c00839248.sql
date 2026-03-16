
-- Trigger function: sync fulfillment_status from status
CREATE OR REPLACE FUNCTION public.sync_order_fulfillment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-sync fulfillment_status based on order status
  IF NEW.status = 'delivered' THEN
    NEW.fulfillment_status := 'delivered';
  ELSIF NEW.status = 'shipped' AND (
    NEW.fulfillment_status IS NULL OR 
    NEW.fulfillment_status IN ('unfulfilled', 'pending', 'fulfilled')
  ) THEN
    NEW.fulfillment_status := 'shipped';
  END IF;
  
  -- Normalize legacy 'fulfilled' to 'shipped'
  IF NEW.fulfillment_status = 'fulfilled' THEN
    NEW.fulfillment_status := 'shipped';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_fulfillment_status ON public.orders;
CREATE TRIGGER trg_sync_fulfillment_status
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_fulfillment_status();

-- Backfill existing inconsistent data
UPDATE public.orders 
SET fulfillment_status = 'shipped' 
WHERE status = 'shipped' 
  AND (fulfillment_status IS NULL OR fulfillment_status IN ('unfulfilled', 'pending', 'fulfilled'));

UPDATE public.orders 
SET fulfillment_status = 'delivered' 
WHERE status = 'delivered' 
  AND (fulfillment_status IS NULL OR fulfillment_status != 'delivered');

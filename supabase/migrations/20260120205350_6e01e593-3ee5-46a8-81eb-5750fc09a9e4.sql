-- Trigger function to decrement stock after POS transaction completion
CREATE OR REPLACE FUNCTION public.handle_pos_transaction_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Loop through all items in the transaction
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) AS i
    LOOP
      -- Decrement stock for each product
      PERFORM public.decrement_stock(
        (item.value->>'product_id')::UUID,
        (item.value->>'quantity')::INTEGER
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on pos_transactions
DROP TRIGGER IF EXISTS pos_transaction_stock_trigger ON public.pos_transactions;
CREATE TRIGGER pos_transaction_stock_trigger
  AFTER INSERT OR UPDATE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pos_transaction_stock();

-- Also create a function to increment stock on refund
CREATE OR REPLACE FUNCTION public.handle_pos_refund_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only process when status changes to 'refunded'
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    -- Loop through all items and restore stock
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) AS i
    LOOP
      UPDATE public.products
      SET stock = stock + (item.value->>'quantity')::INTEGER
      WHERE id = (item.value->>'product_id')::UUID
        AND track_inventory = true;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for refunds
DROP TRIGGER IF EXISTS pos_refund_stock_trigger ON public.pos_transactions;
CREATE TRIGGER pos_refund_stock_trigger
  AFTER UPDATE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pos_refund_stock();
-- Helper: already returned quantity per order_item
CREATE OR REPLACE FUNCTION public.get_already_returned_quantity(_order_item_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(ri.quantity), 0)::INTEGER
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  WHERE ri.order_item_id = _order_item_id
    AND r.status NOT IN ('cancelled', 'rejected')
$$;

-- Helper: returnable quantities per order
CREATE OR REPLACE FUNCTION public.get_order_returnable_items(_order_id UUID)
RETURNS TABLE (
  order_item_id UUID,
  ordered_quantity INTEGER,
  already_returned INTEGER,
  returnable_quantity INTEGER
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    oi.id,
    oi.quantity,
    public.get_already_returned_quantity(oi.id) AS already_returned,
    GREATEST(0, oi.quantity - public.get_already_returned_quantity(oi.id)) AS returnable_quantity
  FROM public.order_items oi
  WHERE oi.order_id = _order_id
$$;

-- Validation trigger: prevent over-returning
CREATE OR REPLACE FUNCTION public.validate_return_item_quantity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ordered_qty INTEGER;
  active_returned_qty INTEGER;
  this_return_status TEXT;
BEGIN
  SELECT status::TEXT INTO this_return_status FROM public.returns WHERE id = NEW.return_id;
  IF this_return_status IN ('cancelled', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF NEW.order_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT quantity INTO ordered_qty FROM public.order_items WHERE id = NEW.order_item_id;
  IF ordered_qty IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(ri.quantity), 0) INTO active_returned_qty
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  WHERE ri.order_item_id = NEW.order_item_id
    AND r.status NOT IN ('cancelled', 'rejected')
    AND ri.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (active_returned_qty + NEW.quantity) > ordered_qty THEN
    RAISE EXCEPTION 'Cannot return % units — only % of % units available (already in active returns: %)',
      NEW.quantity, (ordered_qty - active_returned_qty), ordered_qty, active_returned_qty
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_return_item_quantity_trg ON public.return_items;
CREATE TRIGGER validate_return_item_quantity_trg
BEFORE INSERT OR UPDATE OF quantity, order_item_id ON public.return_items
FOR EACH ROW EXECUTE FUNCTION public.validate_return_item_quantity();

-- Sync function: keep orders aligned with returns
CREATE OR REPLACE FUNCTION public.sync_order_from_returns(_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  order_total NUMERIC;
  order_payment_status TEXT;
  order_status_current TEXT;
  total_ordered_qty INTEGER;
  total_active_returned_qty INTEGER;
  refund_completed_total NUMERIC;
  new_order_status TEXT;
  new_payment_status TEXT;
BEGIN
  SELECT total, payment_status::TEXT, status::TEXT
  INTO order_total, order_payment_status, order_status_current
  FROM public.orders WHERE id = _order_id;

  IF order_total IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(oi.quantity), 0),
    COALESCE((
      SELECT SUM(ri.quantity)
      FROM public.return_items ri
      JOIN public.returns r ON r.id = ri.return_id
      WHERE r.order_id = _order_id
        AND r.status NOT IN ('cancelled', 'rejected')
    ), 0)
  INTO total_ordered_qty, total_active_returned_qty
  FROM public.order_items oi WHERE oi.order_id = _order_id;

  SELECT COALESCE(SUM(refund_amount), 0)
  INTO refund_completed_total
  FROM public.returns
  WHERE order_id = _order_id AND refund_status = 'completed';

  IF total_active_returned_qty = 0 THEN
    new_order_status := order_status_current;
  ELSIF total_active_returned_qty >= total_ordered_qty THEN
    new_order_status := 'returned';
  ELSE
    new_order_status := 'partially_returned';
  END IF;

  IF order_payment_status IN ('paid', 'partially_refunded', 'refunded') THEN
    IF refund_completed_total = 0 THEN
      new_payment_status := 'paid';
    ELSIF refund_completed_total >= order_total THEN
      new_payment_status := 'refunded';
    ELSE
      new_payment_status := 'partially_refunded';
    END IF;
  ELSE
    new_payment_status := order_payment_status;
  END IF;

  UPDATE public.orders
  SET status = new_order_status::public.order_status,
      payment_status = new_payment_status::public.payment_status,
      updated_at = now()
  WHERE id = _order_id
    AND (status::TEXT != new_order_status OR payment_status::TEXT != new_payment_status);
END;
$$;

-- Trigger on returns table
CREATE OR REPLACE FUNCTION public.sync_order_from_returns_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  affected_order_id UUID;
BEGIN
  affected_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF affected_order_id IS NOT NULL THEN
    PERFORM public.sync_order_from_returns(affected_order_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_order_from_returns_trg ON public.returns;
CREATE TRIGGER sync_order_from_returns_trg
AFTER INSERT OR UPDATE OF status, refund_status, refund_amount OR DELETE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.sync_order_from_returns_trigger();

-- Trigger on return_items table
CREATE OR REPLACE FUNCTION public.sync_order_from_return_items_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  affected_order_id UUID;
BEGIN
  SELECT order_id INTO affected_order_id FROM public.returns
  WHERE id = COALESCE(NEW.return_id, OLD.return_id);
  IF affected_order_id IS NOT NULL THEN
    PERFORM public.sync_order_from_returns(affected_order_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_order_from_return_items_trg ON public.return_items;
CREATE TRIGGER sync_order_from_return_items_trg
AFTER INSERT OR UPDATE OF quantity OR DELETE ON public.return_items
FOR EACH ROW EXECUTE FUNCTION public.sync_order_from_return_items_trigger();

-- Backfill existing orders
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT order_id FROM public.returns WHERE order_id IS NOT NULL
  LOOP
    PERFORM public.sync_order_from_returns(r.order_id);
  END LOOP;
END $$;
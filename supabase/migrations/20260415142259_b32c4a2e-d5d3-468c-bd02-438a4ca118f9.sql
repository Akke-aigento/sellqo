CREATE OR REPLACE FUNCTION public.get_order_return_tag(_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_returns BOOLEAN;
  all_completed BOOLEAN;
  any_awaiting_refund BOOLEAN;
  any_denied BOOLEAN;
  any_partial BOOLEAN;
  total_items INTEGER;
  returned_items INTEGER;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.returns WHERE order_id = _order_id AND status != 'cancelled') INTO has_returns;
  IF NOT has_returns THEN RETURN NULL; END IF;
  
  SELECT NOT EXISTS (
    SELECT 1 FROM public.returns 
    WHERE order_id = _order_id 
      AND (status NOT IN ('closed') OR refund_status NOT IN ('completed', 'not_applicable', 'denied'))
  ) INTO all_completed;
  
  SELECT EXISTS (
    SELECT 1 FROM public.returns 
    WHERE order_id = _order_id 
      AND status IN ('inspected', 'closed') 
      AND refund_status IN ('pending', 'approved_for_refund', 'initiated')
  ) INTO any_awaiting_refund;
  
  SELECT EXISTS (
    SELECT 1 FROM public.returns 
    WHERE order_id = _order_id 
      AND (status IN ('rejected', 'cancelled') OR refund_status = 'denied')
  ) INTO any_denied;

  SELECT 
    (SELECT COALESCE(SUM(quantity), 0) FROM public.order_items WHERE order_id = _order_id),
    (SELECT COALESCE(SUM(ri.quantity), 0) FROM public.return_items ri 
     JOIN public.returns r ON ri.return_id = r.id 
     WHERE r.order_id = _order_id AND r.status NOT IN ('rejected', 'cancelled'))
  INTO total_items, returned_items;
  any_partial := returned_items < total_items;
  
  RETURN CASE
    WHEN all_completed THEN 'retour_ok'
    WHEN any_awaiting_refund THEN 'retour_wacht_op_refund'
    WHEN any_denied THEN 'retour_afgewezen'
    WHEN any_partial THEN 'retour_deels_lopend'
    ELSE 'retour_lopend'
  END;
END;
$$;
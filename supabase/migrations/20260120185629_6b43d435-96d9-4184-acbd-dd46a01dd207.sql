-- =====================================================
-- FASE 2: VOORRAAD NOTIFICATIES
-- Automatische triggers voor stock level changes
-- =====================================================

-- Trigger function voor voorraad notificaties
CREATE OR REPLACE FUNCTION public.handle_stock_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_threshold INTEGER;
BEGIN
  -- Alleen controleren als inventory tracking aan staat
  IF NOT COALESCE(NEW.track_inventory, true) THEN
    RETURN NEW;
  END IF;
  
  v_action_url := '/admin/products?id=' || NEW.id;
  v_threshold := COALESCE(NEW.low_stock_threshold, 5);
  
  -- UITVERKOCHT: stock gaat naar 0
  IF NEW.stock = 0 AND (OLD.stock IS NULL OR OLD.stock > 0) THEN
    v_type := 'stock_out';
    v_title := 'Uitverkocht: ' || NEW.name;
    v_message := 'Product "' || NEW.name || '" is uitverkocht';
    v_priority := 'urgent';
    
  -- KRITIEK: stock < 5 (hardcoded kritiek niveau)
  ELSIF NEW.stock > 0 AND NEW.stock < 5 
        AND (OLD.stock IS NULL OR OLD.stock >= 5) THEN
    v_type := 'stock_critical';
    v_title := 'Kritieke voorraad: ' || NEW.name;
    v_message := 'Product "' || NEW.name || '" heeft nog maar ' || NEW.stock || ' stuks op voorraad';
    v_priority := 'high';
    
  -- LAAG: stock < low_stock_threshold (maar >= 5)
  ELSIF NEW.stock > 0 AND NEW.stock < v_threshold 
        AND NEW.stock >= 5
        AND (OLD.stock IS NULL OR OLD.stock >= v_threshold) THEN
    v_type := 'stock_low';
    v_title := 'Lage voorraad: ' || NEW.name;
    v_message := 'Product "' || NEW.name || '" heeft nog maar ' || NEW.stock || ' stuks (minimum: ' || v_threshold || ')';
    v_priority := 'medium';
    
  -- AANGEVULD: stock gaat van < threshold naar >= threshold
  ELSIF NEW.stock >= v_threshold 
        AND OLD.stock IS NOT NULL 
        AND OLD.stock < v_threshold THEN
    v_type := 'stock_replenished';
    v_title := 'Voorraad aangevuld: ' || NEW.name;
    v_message := 'Product "' || NEW.name || '" is weer op voorraad (' || NEW.stock || ' stuks)';
    v_priority := 'low';
    
  ELSE
    -- Geen relevante verandering
    RETURN NEW;
  END IF;
  
  -- Notificatie versturen via helper function
  PERFORM public.send_notification(
    NEW.tenant_id,
    'products',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'product_id', NEW.id, 
      'product_name', NEW.name,
      'sku', NEW.sku,
      'current_stock', NEW.stock,
      'previous_stock', OLD.stock,
      'threshold', v_threshold
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger op products tabel voor stock wijzigingen
DROP TRIGGER IF EXISTS trigger_stock_notification ON public.products;
CREATE TRIGGER trigger_stock_notification
  AFTER INSERT OR UPDATE OF stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_stock_notification();
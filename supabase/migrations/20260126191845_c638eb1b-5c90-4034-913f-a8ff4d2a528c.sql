-- Database functions voor product bulk bewerkingen

-- Bulk prijs aanpassing
CREATE OR REPLACE FUNCTION public.bulk_adjust_prices(
  p_product_ids UUID[],
  p_adjustment_type TEXT,
  p_adjustment_value DECIMAL,
  p_price_field TEXT DEFAULT 'price'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  IF p_price_field = 'price' THEN
    IF p_adjustment_type = 'add' THEN
      UPDATE products SET price = price + p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'subtract' THEN
      UPDATE products SET price = GREATEST(0, price - p_adjustment_value), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'percentage_up' THEN
      UPDATE products SET price = ROUND((price * (1 + p_adjustment_value / 100))::numeric, 2), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'percentage_down' THEN
      UPDATE products SET price = ROUND((price * (1 - p_adjustment_value / 100))::numeric, 2), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'exact' THEN
      UPDATE products SET price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  ELSIF p_price_field = 'compare_at_price' THEN
    IF p_adjustment_type = 'remove' THEN
      UPDATE products SET compare_at_price = NULL, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'set_current' THEN
      UPDATE products SET compare_at_price = price, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'exact' THEN
      UPDATE products SET compare_at_price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  ELSIF p_price_field = 'cost_price' THEN
    IF p_adjustment_type = 'exact' THEN
      UPDATE products SET cost_price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'remove' THEN
      UPDATE products SET cost_price = NULL, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  END IF;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- Bulk voorraad aanpassing
CREATE OR REPLACE FUNCTION public.bulk_adjust_stock(
  p_product_ids UUID[],
  p_adjustment_type TEXT,
  p_adjustment_value INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  IF p_adjustment_type = 'add' THEN
    UPDATE products SET stock = stock + p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'subtract' THEN
    UPDATE products SET stock = GREATEST(0, stock - p_adjustment_value), updated_at = now() WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'exact' THEN
    UPDATE products SET stock = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
  END IF;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- Bulk tags beheer
CREATE OR REPLACE FUNCTION public.bulk_update_tags(
  p_product_ids UUID[],
  p_tags_to_add TEXT[] DEFAULT '{}',
  p_tags_to_remove TEXT[] DEFAULT '{}',
  p_replace_all BOOLEAN DEFAULT false,
  p_replacement_tags TEXT[] DEFAULT '{}'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  IF p_replace_all THEN
    UPDATE products SET tags = p_replacement_tags, updated_at = now() WHERE id = ANY(p_product_ids);
  ELSE
    -- Add tags first
    IF array_length(p_tags_to_add, 1) > 0 THEN
      UPDATE products 
      SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(tags || p_tags_to_add) t),
          updated_at = now()
      WHERE id = ANY(p_product_ids);
    END IF;
    
    -- Remove tags
    IF array_length(p_tags_to_remove, 1) > 0 THEN
      UPDATE products 
      SET tags = (SELECT COALESCE(array_agg(t), '{}') FROM unnest(tags) t WHERE t != ALL(p_tags_to_remove)),
          updated_at = now()
      WHERE id = ANY(p_product_ids);
    END IF;
  END IF;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- Bulk social channels update
CREATE OR REPLACE FUNCTION public.bulk_update_social_channels(
  p_product_ids UUID[],
  p_social_channels JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE products 
  SET social_channels = p_social_channels,
      updated_at = now()
  WHERE id = ANY(p_product_ids);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;
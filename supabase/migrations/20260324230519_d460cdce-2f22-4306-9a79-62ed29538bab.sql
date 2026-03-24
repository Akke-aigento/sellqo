
-- Auto-tagging function for customers
CREATE OR REPLACE FUNCTION public.auto_tag_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_tags TEXT[];
  v_existing_tags TEXT[];
  v_days_since_order INTEGER;
  v_has_pos BOOLEAN;
  v_has_online BOOLEAN;
BEGIN
  v_existing_tags := COALESCE(NEW.tags, '{}');
  v_new_tags := v_existing_tags;

  -- VIP: total_spent > 500
  IF COALESCE(NEW.total_spent, 0) >= 500 AND NOT ('VIP' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'VIP');
  ELSIF COALESCE(NEW.total_spent, 0) < 500 THEN
    v_new_tags := array_remove(v_new_tags, 'VIP');
  END IF;

  -- Top klant: total_spent > 1000
  IF COALESCE(NEW.total_spent, 0) >= 1000 AND NOT ('Top klant' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'Top klant');
  ELSIF COALESCE(NEW.total_spent, 0) < 1000 THEN
    v_new_tags := array_remove(v_new_tags, 'Top klant');
  END IF;

  -- Trouwe klant: 5+ orders
  IF COALESCE(NEW.total_orders, 0) >= 5 AND NOT ('Trouwe klant' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'Trouwe klant');
  ELSIF COALESCE(NEW.total_orders, 0) < 5 THEN
    v_new_tags := array_remove(v_new_tags, 'Trouwe klant');
  END IF;

  -- B2B Verified: has verified VAT
  IF COALESCE(NEW.vat_verified, false) = true AND NOT ('B2B Verified' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'B2B Verified');
  ELSIF COALESCE(NEW.vat_verified, false) = false THEN
    v_new_tags := array_remove(v_new_tags, 'B2B Verified');
  END IF;

  -- Nieuwsbrief-lezer: high engagement
  IF COALESCE(NEW.email_engagement_score, 0) >= 70 AND NOT ('Nieuwsbrief-lezer' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'Nieuwsbrief-lezer');
  ELSIF COALESCE(NEW.email_engagement_score, 0) < 70 THEN
    v_new_tags := array_remove(v_new_tags, 'Nieuwsbrief-lezer');
  END IF;

  -- Slapend: no orders in 90+ days (check via last order)
  IF COALESCE(NEW.total_orders, 0) > 0 THEN
    SELECT EXTRACT(DAY FROM now() - MAX(created_at))::INTEGER
    INTO v_days_since_order
    FROM orders
    WHERE customer_id = NEW.id AND status != 'cancelled';

    IF v_days_since_order IS NOT NULL AND v_days_since_order > 90 AND NOT ('Slapend' = ANY(v_new_tags)) THEN
      v_new_tags := array_append(v_new_tags, 'Slapend');
    ELSIF v_days_since_order IS NOT NULL AND v_days_since_order <= 90 THEN
      v_new_tags := array_remove(v_new_tags, 'Slapend');
    END IF;
  END IF;

  -- Fysieke klant: has POS transactions
  SELECT EXISTS(SELECT 1 FROM pos_transactions WHERE customer_id = NEW.id AND status = 'completed' LIMIT 1)
  INTO v_has_pos;
  IF v_has_pos AND NOT ('Fysieke klant' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'Fysieke klant');
  END IF;

  -- Omni-channel: has both online orders AND POS
  SELECT EXISTS(SELECT 1 FROM orders WHERE customer_id = NEW.id AND sales_channel = 'webshop' LIMIT 1)
  INTO v_has_online;
  IF v_has_pos AND v_has_online AND NOT ('Omni-channel' = ANY(v_new_tags)) THEN
    v_new_tags := array_append(v_new_tags, 'Omni-channel');
  END IF;

  -- Only update if tags actually changed
  IF v_new_tags IS DISTINCT FROM v_existing_tags THEN
    NEW.tags := v_new_tags;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_tag_customer ON public.customers;
CREATE TRIGGER trg_auto_tag_customer
  BEFORE INSERT OR UPDATE OF total_spent, total_orders, vat_verified, email_engagement_score, tags
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_tag_customer();

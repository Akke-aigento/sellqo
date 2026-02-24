
-- Fix the delete trigger function (UPDATE doesn't support ORDER BY/LIMIT in plpgsql)
CREATE OR REPLACE FUNCTION public.handle_primary_category_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  IF OLD.is_primary = true THEN
    -- Find next category to promote
    SELECT id INTO v_next_id
    FROM public.product_categories
    WHERE product_id = OLD.product_id
      AND id != OLD.id
    ORDER BY sort_order ASC
    LIMIT 1;

    IF v_next_id IS NOT NULL THEN
      UPDATE public.product_categories
      SET is_primary = true
      WHERE id = v_next_id;
    ELSE
      UPDATE public.products
      SET category_id = NULL
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

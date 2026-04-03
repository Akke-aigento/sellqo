CREATE OR REPLACE FUNCTION public.increment_discount_usage(_code text, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE discount_codes
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE tenant_id = _tenant_id AND code = _code;
END;
$$;
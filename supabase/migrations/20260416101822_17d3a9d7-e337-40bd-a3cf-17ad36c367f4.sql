
CREATE OR REPLACE FUNCTION public.get_tenant_storage_bytes(p_tenant_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  FROM storage.objects
  WHERE name LIKE p_tenant_id::text || '/%'
$$;

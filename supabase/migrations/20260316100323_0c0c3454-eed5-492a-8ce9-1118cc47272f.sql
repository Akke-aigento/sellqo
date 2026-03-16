DROP POLICY IF EXISTS "Public can view tenant basic info by slug" ON public.tenants;

CREATE POLICY "Anon can view tenant basic info"
  ON public.tenants FOR SELECT
  TO anon
  USING (true);
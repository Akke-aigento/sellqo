CREATE POLICY "Public can view tenant basic info by slug"
  ON public.tenants
  FOR SELECT
  USING (true);
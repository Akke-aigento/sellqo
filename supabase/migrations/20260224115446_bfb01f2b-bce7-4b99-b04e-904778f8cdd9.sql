
-- Public SELECT policy for products (only active, non-hidden)
CREATE POLICY "Public can view active storefront products"
  ON public.products
  FOR SELECT
  USING (is_active = true AND hide_from_storefront = false);

-- Public SELECT policy for categories (only active, non-hidden)
CREATE POLICY "Public can view active storefront categories"
  ON public.categories
  FOR SELECT
  USING (is_active = true AND hide_from_storefront = false);

-- Public SELECT policy for legal pages (only published)
CREATE POLICY "Public can view published legal pages"
  ON public.legal_pages
  FOR SELECT
  USING (is_published = true);

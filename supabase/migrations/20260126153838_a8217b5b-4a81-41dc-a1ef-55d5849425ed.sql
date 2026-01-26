-- Publieke SELECT toegang voor orders (alleen lezen, UUID is de beveiliging)
CREATE POLICY "Public can view orders by id"
ON public.orders FOR SELECT
TO anon
USING (true);

-- Publieke SELECT toegang voor order_items  
CREATE POLICY "Public can view order items"
ON public.order_items FOR SELECT
TO anon
USING (true);
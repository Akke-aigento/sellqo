DROP POLICY IF EXISTS "Anon can view recent orders by id" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders by id" ON public.orders;
DROP POLICY IF EXISTS "Anon can view order items for recent orders" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP VIEW IF EXISTS public.order_confirmation_view;
DROP VIEW IF EXISTS public.order_items_confirmation_view;
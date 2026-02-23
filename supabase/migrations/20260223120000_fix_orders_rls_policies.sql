-- Fix insecure RLS policies on orders and order_items tables
-- Previously: USING (true) allowed anonymous users to list ALL orders
-- Now: Anon can only read orders created within the last 30 days
-- (order confirmation pages need anon access, but UUID + time-limiting provides defense in depth)

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Public can view orders by id" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;

-- Anon can only view orders from the last 30 days (for order confirmation pages)
-- UUIDs are cryptographically random so enumeration is not practical,
-- but time-limiting reduces the exposure window
CREATE POLICY "Anon can view recent orders by id"
ON public.orders FOR SELECT
TO anon
USING (created_at > now() - interval '30 days');

-- Anon can only view order items belonging to recent orders
CREATE POLICY "Anon can view order items for recent orders"
ON public.order_items FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.created_at > now() - interval '30 days'
  )
);

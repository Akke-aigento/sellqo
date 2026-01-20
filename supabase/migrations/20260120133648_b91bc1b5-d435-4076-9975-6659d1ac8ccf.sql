-- Add service point fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT 'home_delivery',
ADD COLUMN IF NOT EXISTS service_point_id text,
ADD COLUMN IF NOT EXISTS service_point_data jsonb;

-- Add index for filtering by delivery type
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON public.orders(delivery_type);

-- Add check constraint for delivery_type
ALTER TABLE public.orders
ADD CONSTRAINT orders_delivery_type_check 
CHECK (delivery_type IN ('home_delivery', 'service_point'));

-- Comment for documentation
COMMENT ON COLUMN public.orders.delivery_type IS 'Type of delivery: home_delivery or service_point';
COMMENT ON COLUMN public.orders.service_point_id IS 'External ID of the selected service point from shipping provider';
COMMENT ON COLUMN public.orders.service_point_data IS 'Complete service point data including name, address, opening hours';
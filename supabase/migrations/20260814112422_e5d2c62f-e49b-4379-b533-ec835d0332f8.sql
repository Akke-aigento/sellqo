ALTER TABLE public.storefront_cart_items ADD COLUMN IF NOT EXISTS event_detail_id uuid NULL REFERENCES public.event_details(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS event_detail_id uuid NULL REFERENCES public.event_details(id);
CREATE INDEX IF NOT EXISTS idx_order_items_event_detail_id ON public.order_items(event_detail_id) WHERE event_detail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storefront_cart_items_event_detail_id ON public.storefront_cart_items(event_detail_id) WHERE event_detail_id IS NOT NULL;
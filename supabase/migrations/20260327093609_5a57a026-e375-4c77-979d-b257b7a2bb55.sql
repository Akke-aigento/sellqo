
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON public.returns(customer_id);

UPDATE public.returns SET customer_id = orders.customer_id FROM public.orders WHERE returns.order_id = orders.id AND returns.customer_id IS NULL;

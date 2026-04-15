ALTER TABLE public.storefront_carts ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS locale TEXT;
COMMENT ON COLUMN public.orders.locale IS 'Customer language at checkout, e.g. nl/en/fr — used for transactional emails';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS support_email TEXT;
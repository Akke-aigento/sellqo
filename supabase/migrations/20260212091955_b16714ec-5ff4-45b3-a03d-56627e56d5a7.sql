
-- Storefront Carts
CREATE TABLE public.storefront_carts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  customer_id uuid NULL,
  currency text NOT NULL DEFAULT 'EUR',
  discount_code text NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_storefront_carts_tenant_session ON public.storefront_carts(tenant_id, session_id);
CREATE INDEX idx_storefront_carts_expires ON public.storefront_carts(expires_at);

ALTER TABLE public.storefront_carts ENABLE ROW LEVEL SECURITY;

-- Public read/write via edge function (service role), no direct client access
CREATE POLICY "Service role full access on storefront_carts"
  ON public.storefront_carts FOR ALL
  USING (true) WITH CHECK (true);

-- Storefront Cart Items
CREATE TABLE public.storefront_cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES public.storefront_carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_storefront_cart_items_cart ON public.storefront_cart_items(cart_id);

ALTER TABLE public.storefront_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on storefront_cart_items"
  ON public.storefront_cart_items FOR ALL
  USING (true) WITH CHECK (true);

-- Storefront Customers (per-tenant shopper accounts)
CREATE TABLE public.storefront_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text NULL,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_storefront_customers_tenant ON public.storefront_customers(tenant_id);

ALTER TABLE public.storefront_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on storefront_customers"
  ON public.storefront_customers FOR ALL
  USING (true) WITH CHECK (true);

-- Add customer_id FK now that table exists
ALTER TABLE public.storefront_carts
  ADD CONSTRAINT storefront_carts_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.storefront_customers(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_storefront_carts_updated_at
  BEFORE UPDATE ON public.storefront_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storefront_customers_updated_at
  BEFORE UPDATE ON public.storefront_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

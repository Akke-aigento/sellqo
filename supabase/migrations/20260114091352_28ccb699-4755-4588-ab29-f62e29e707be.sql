-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  default_shipping_address JSONB,
  default_billing_address JSONB,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status public.order_status DEFAULT 'pending',
  payment_status public.payment_status DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  notes TEXT,
  internal_notes TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, order_number)
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Platform admins can view all customers"
ON public.customers FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any customer"
ON public.customers FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any customer"
ON public.customers FOR UPDATE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any customer"
ON public.customers FOR DELETE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's customers"
ON public.customers FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert customers for their tenant"
ON public.customers FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Users can update their tenant's customers"
ON public.customers FOR UPDATE
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Tenant admins can delete their tenant's customers"
ON public.customers FOR DELETE
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND has_role(auth.uid(), 'tenant_admin')
);

-- RLS Policies for orders
CREATE POLICY "Platform admins can view all orders"
ON public.orders FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any order"
ON public.orders FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any order"
ON public.orders FOR UPDATE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any order"
ON public.orders FOR DELETE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's orders"
ON public.orders FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert orders for their tenant"
ON public.orders FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Users can update their tenant's orders"
ON public.orders FOR UPDATE
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Tenant admins can delete their tenant's orders"
ON public.orders FOR DELETE
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND has_role(auth.uid(), 'tenant_admin')
);

-- RLS Policies for order_items (inherit from parent order)
CREATE POLICY "Platform admins can view all order items"
ON public.order_items FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any order item"
ON public.order_items FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any order item"
ON public.order_items FOR UPDATE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any order item"
ON public.order_items FOR DELETE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's order items"
ON public.order_items FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can insert order items for their tenant"
ON public.order_items FOR INSERT
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Users can update their tenant's order items"
ON public.order_items FOR UPDATE
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Tenant admins can delete their tenant's order items"
ON public.order_items FOR DELETE
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  AND has_role(auth.uid(), 'tenant_admin')
);

-- Add updated_at triggers
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to generate next order number for a tenant
CREATE OR REPLACE FUNCTION public.generate_order_number(_tenant_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders
  WHERE tenant_id = _tenant_id;
  
  RETURN '#' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Function to update customer stats when order is placed/updated
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET 
      total_orders = (
        SELECT COUNT(*) FROM public.orders 
        WHERE customer_id = NEW.customer_id 
        AND status != 'cancelled'
      ),
      total_spent = (
        SELECT COALESCE(SUM(total), 0) FROM public.orders 
        WHERE customer_id = NEW.customer_id 
        AND payment_status = 'paid'
      ),
      updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_customer_stats_on_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_stats();
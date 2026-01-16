-- Create quote_status enum
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted');

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_number TEXT NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  valid_until TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  internal_notes TEXT,
  payment_link TEXT,
  converted_order_id UUID REFERENCES public.orders(id),
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote_items table
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to generate quote number
CREATE OR REPLACE FUNCTION public.generate_quote_number(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM 'Q-' || current_year || '-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE tenant_id = _tenant_id
    AND quote_number LIKE 'Q-' || current_year || '-%';
  
  RETURN 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Platform admins can view all quotes" ON public.quotes
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any quote" ON public.quotes
  FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any quote" ON public.quotes
  FOR UPDATE USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any quote" ON public.quotes
  FOR DELETE USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's quotes" ON public.quotes
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert quotes for their tenant" ON public.quotes
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Users can update their tenant's quotes" ON public.quotes
  FOR UPDATE USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Tenant admins can delete their tenant's quotes" ON public.quotes
  FOR DELETE USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND has_role(auth.uid(), 'tenant_admin')
  );

-- RLS Policies for quote_items
CREATE POLICY "Platform admins can view all quote items" ON public.quote_items
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any quote item" ON public.quote_items
  FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any quote item" ON public.quote_items
  FOR UPDATE USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any quote item" ON public.quote_items
  FOR DELETE USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's quote items" ON public.quote_items
  FOR SELECT USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can insert quote items for their tenant" ON public.quote_items
  FOR INSERT WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Users can update their tenant's quote items" ON public.quote_items
  FOR UPDATE USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Tenant admins can delete their tenant's quote items" ON public.quote_items
  FOR DELETE USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
    AND has_role(auth.uid(), 'tenant_admin')
  );

-- Add updated_at trigger for quotes
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_quotes_tenant_id ON public.quotes(tenant_id);
CREATE INDEX idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
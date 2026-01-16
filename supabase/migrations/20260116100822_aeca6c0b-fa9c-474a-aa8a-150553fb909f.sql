-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'cancelled');

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  pdf_url TEXT,
  ubl_url TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, invoice_number)
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Platform admins can view all invoices"
  ON public.invoices FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any invoice"
  ON public.invoices FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any invoice"
  ON public.invoices FOR UPDATE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any invoice"
  ON public.invoices FOR DELETE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's invoices"
  ON public.invoices FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert invoices for their tenant"
  ON public.invoices FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Users can update their tenant's invoices"
  ON public.invoices FOR UPDATE
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Tenant admins can delete their tenant's invoices"
  ON public.invoices FOR DELETE
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND has_role(auth.uid(), 'tenant_admin')
  );

-- Add invoice settings to tenants table
ALTER TABLE public.tenants
ADD COLUMN auto_send_invoices BOOLEAN DEFAULT true,
ADD COLUMN invoice_format TEXT DEFAULT 'pdf',
ADD COLUMN invoice_prefix TEXT DEFAULT 'INV',
ADD COLUMN invoice_email_subject TEXT,
ADD COLUMN invoice_email_body TEXT;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(invoice_prefix, 'INV') INTO prefix
  FROM public.tenants WHERE id = _tenant_id;
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_number FROM prefix || '-' || current_year || '-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE tenant_id = _tenant_id
    AND invoice_number LIKE prefix || '-' || current_year || '-%';
  
  RETURN prefix || '-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Create updated_at trigger for invoices
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket
CREATE POLICY "Anyone can view invoice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices');

CREATE POLICY "Service role can upload invoice files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Service role can update invoice files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'invoices');

CREATE POLICY "Service role can delete invoice files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices');
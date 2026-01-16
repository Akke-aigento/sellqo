-- Add IBAN bank account to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS iban text,
ADD COLUMN IF NOT EXISTS bic text,
ADD COLUMN IF NOT EXISTS invoice_start_number integer DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN public.tenants.iban IS 'IBAN bank account number for invoices';
COMMENT ON COLUMN public.tenants.bic IS 'BIC/SWIFT code for international payments';
COMMENT ON COLUMN public.tenants.invoice_start_number IS 'Starting number for invoice numbering';

-- Update generate_invoice_number function to use invoice_start_number
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
  start_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(invoice_prefix, 'INV'), COALESCE(invoice_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_number FROM prefix || '-' || current_year || '-(\d+)') 
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.invoices
  WHERE tenant_id = _tenant_id
    AND invoice_number LIKE prefix || '-' || current_year || '-%';
  
  RETURN prefix || '-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;
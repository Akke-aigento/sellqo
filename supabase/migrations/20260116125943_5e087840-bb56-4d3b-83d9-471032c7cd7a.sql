-- Credit notes table
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  credit_note_number VARCHAR(50) NOT NULL,
  original_invoice_id UUID REFERENCES public.invoices(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'partial', 'correction')),
  reason TEXT NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'processed')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ogm_reference VARCHAR(20),
  pdf_url TEXT,
  ubl_url TEXT,
  peppol_required BOOLEAN DEFAULT FALSE,
  peppol_status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, credit_note_number)
);

-- Credit note lines table
CREATE TABLE public.credit_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE NOT NULL,
  original_invoice_line_id UUID,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  line_type VARCHAR(20) DEFAULT 'product' CHECK (line_type IN ('product', 'shipping', 'discount')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add OGM reference to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS ogm_reference VARCHAR(20);

-- Add credit note settings to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS credit_note_prefix VARCHAR(20) DEFAULT 'CN-';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS credit_note_start_number INTEGER DEFAULT 1;

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_notes
CREATE POLICY "Users can view credit notes from their tenants"
ON public.credit_notes FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert credit notes in their tenants"
ON public.credit_notes FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update credit notes in their tenants"
ON public.credit_notes FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete credit notes in their tenants"
ON public.credit_notes FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS policies for credit_note_lines
CREATE POLICY "Users can view credit note lines from their tenants"
ON public.credit_note_lines FOR SELECT
USING (credit_note_id IN (
  SELECT id FROM public.credit_notes 
  WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can insert credit note lines in their tenants"
ON public.credit_note_lines FOR INSERT
WITH CHECK (credit_note_id IN (
  SELECT id FROM public.credit_notes 
  WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can update credit note lines in their tenants"
ON public.credit_note_lines FOR UPDATE
USING (credit_note_id IN (
  SELECT id FROM public.credit_notes 
  WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can delete credit note lines in their tenants"
ON public.credit_note_lines FOR DELETE
USING (credit_note_id IN (
  SELECT id FROM public.credit_notes 
  WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

-- Function to generate credit note number
CREATE OR REPLACE FUNCTION public.generate_credit_note_number(_tenant_id uuid)
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
  
  SELECT COALESCE(credit_note_prefix, 'CN-'), COALESCE(credit_note_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(credit_note_number FROM prefix || current_year || '-(\d+)') 
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.credit_notes
  WHERE tenant_id = _tenant_id
    AND credit_note_number LIKE prefix || current_year || '-%';
  
  RETURN prefix || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Updated_at trigger
CREATE TRIGGER update_credit_notes_updated_at
BEFORE UPDATE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
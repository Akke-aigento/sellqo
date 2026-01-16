-- Task 7: Invoice Archive table for 7-year retention
CREATE TABLE IF NOT EXISTS public.invoice_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('invoice', 'credit_note')),
  document_number VARCHAR(50) NOT NULL,
  pdf_storage_key VARCHAR(255) NOT NULL,
  ubl_storage_key VARCHAR(255),
  cii_storage_key VARCHAR(255),
  sha256_hash VARCHAR(64) NOT NULL,
  file_size_bytes INTEGER,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for archive table
CREATE INDEX IF NOT EXISTS idx_archive_tenant ON public.invoice_archive(tenant_id);
CREATE INDEX IF NOT EXISTS idx_archive_document ON public.invoice_archive(document_id);
CREATE INDEX IF NOT EXISTS idx_archive_number ON public.invoice_archive(document_number);
CREATE INDEX IF NOT EXISTS idx_archive_expires ON public.invoice_archive(expires_at);

-- Enable RLS on invoice_archive
ALTER TABLE public.invoice_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_archive
CREATE POLICY "Users can view archive for their tenant"
  ON public.invoice_archive FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert archive for their tenant"
  ON public.invoice_archive FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Add peppol_required column to invoices if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'peppol_required') THEN
    ALTER TABLE public.invoices ADD COLUMN peppol_required BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add peppol_id to customers if not exists (should already exist but making sure)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'peppol_id') THEN
    ALTER TABLE public.customers ADD COLUMN peppol_id VARCHAR(100);
  END IF;
END $$;

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_invoice_archive_updated_at
  BEFORE UPDATE ON public.invoice_archive
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
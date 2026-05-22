-- Create private bucket for Peppol UBL archive
INSERT INTO storage.buckets (id, name, public)
VALUES ('peppol-archive', 'peppol-archive', false)
ON CONFLICT (id) DO NOTHING;

-- Tenant-scoped read policy: path layout is {tenant_id}/{invoice_id}.xml
CREATE POLICY "Tenant members can read their peppol archive"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'peppol-archive'
  AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- No public INSERT/UPDATE/DELETE policies → only service role can write.

-- Add generated_at column
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ubl_generated_at TIMESTAMPTZ;
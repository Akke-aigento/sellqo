
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'nl';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_language_check'
  ) THEN
    ALTER TABLE public.credit_notes
      ADD CONSTRAINT credit_notes_language_check
      CHECK (language IN ('nl','en','fr','de'));
  END IF;
END $$;

DROP POLICY IF EXISTS "credit-notes tenant read" ON storage.objects;
CREATE POLICY "credit-notes tenant read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'credit-notes'
  AND (
    public.is_platform_admin(auth.uid())
    OR public.has_tenant_role(
      ((string_to_array(name, '/'))[1])::uuid,
      ARRAY['tenant_admin','staff','accountant']::app_role[]
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_archive_document_id_key
  ON public.invoice_archive (document_id);
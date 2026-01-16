-- Add CC and BCC fields for invoice emails
ALTER TABLE public.tenants
ADD COLUMN invoice_cc_email TEXT,
ADD COLUMN invoice_bcc_email TEXT;
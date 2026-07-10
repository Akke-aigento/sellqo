ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bank_transfer_hide_qr_mobile boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tenants.bank_transfer_hide_qr_mobile IS
  'Indien true: EPC-QR-code wordt verborgen op mobiele toestellen bij bankoverschrijving. Manuele gegevens blijven altijd zichtbaar.';
ALTER TABLE public.event_details
  ADD COLUMN IF NOT EXISTS early_bird_price numeric NULL,
  ADD COLUMN IF NOT EXISTS early_bird_deadline timestamptz NULL,
  ADD COLUMN IF NOT EXISTS early_bird_quantity integer NULL;

COMMENT ON COLUMN public.event_details.early_bird_price IS 'Early-bird prijs; NULL = geen early bird op dit event.';
COMMENT ON COLUMN public.event_details.early_bird_deadline IS 'Absoluut moment (timestamptz) waarna early bird stopt; NULL = geen tijd-grens.';
COMMENT ON COLUMN public.event_details.early_bird_quantity IS 'Aantal tickets aan early-bird prijs; NULL = geen aantal-grens.';

-- DOWN (handmatig): ALTER TABLE public.event_details DROP COLUMN early_bird_price, DROP COLUMN early_bird_deadline, DROP COLUMN early_bird_quantity;
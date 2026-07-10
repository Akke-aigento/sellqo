
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_return_id_unique
  ON public.credit_notes(return_id)
  WHERE return_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_stripe_refund_id_unique
  ON public.credit_notes(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS credit_note_id uuid REFERENCES public.credit_notes(id) ON DELETE SET NULL;

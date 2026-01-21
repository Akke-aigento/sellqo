-- Add fields to track POS sales and printing
ALTER TABLE public.gift_cards 
ADD COLUMN IF NOT EXISTS sold_via_pos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pos_terminal_id UUID REFERENCES public.pos_terminals(id),
ADD COLUMN IF NOT EXISTS pos_transaction_id UUID REFERENCES public.pos_transactions(id);
-- Fase 1: Extend products table for gift cards
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS gift_card_denominations DECIMAL[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gift_card_min_amount DECIMAL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS gift_card_max_amount DECIMAL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS gift_card_allow_custom BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gift_card_expiry_months INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gift_card_design_id UUID REFERENCES public.gift_card_designs(id) DEFAULT NULL;

-- Fase 3 & 5: Add email tracking to gift_cards
ALTER TABLE public.gift_cards 
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_resent_count INTEGER DEFAULT 0;

-- Fase 5: Link order items to gift cards
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS gift_card_id UUID REFERENCES public.gift_cards(id) DEFAULT NULL;

-- Fase 4: Add gift card payment tracking to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_gift_card_ids UUID[] DEFAULT NULL;
-- Add gift_card_metadata column to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS gift_card_metadata JSONB DEFAULT NULL;
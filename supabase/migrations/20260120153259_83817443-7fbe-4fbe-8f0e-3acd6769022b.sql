-- Create gift card status enum
CREATE TYPE gift_card_status AS ENUM ('active', 'depleted', 'expired', 'disabled');

-- Create gift card transaction type enum
CREATE TYPE gift_card_transaction_type AS ENUM ('purchase', 'redeem', 'refund', 'adjustment');

-- Create gift card designs table
CREATE TABLE public.gift_card_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  theme TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create gift cards table
CREATE TABLE public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  initial_balance DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status gift_card_status NOT NULL DEFAULT 'active',
  purchased_by_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  purchased_by_email TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  personal_message TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  design_id UUID REFERENCES public.gift_card_designs(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Create gift card transactions table
CREATE TABLE public.gift_card_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  transaction_type gift_card_transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add gift card columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS gift_card_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2) DEFAULT 0;

-- Add gift_card to product_type enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gift_card' AND enumtypid = 'product_type'::regtype) THEN
    ALTER TYPE product_type ADD VALUE 'gift_card';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.gift_card_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gift_card_designs
CREATE POLICY "Tenant users can view gift card designs"
  ON public.gift_card_designs FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage gift card designs"
  ON public.gift_card_designs FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for gift_cards
CREATE POLICY "Tenant users can view gift cards"
  ON public.gift_cards FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage gift cards"
  ON public.gift_cards FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for gift_card_transactions
CREATE POLICY "Tenant users can view gift card transactions"
  ON public.gift_card_transactions FOR SELECT
  USING (gift_card_id IN (
    SELECT id FROM public.gift_cards 
    WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Tenant admins can manage gift card transactions"
  ON public.gift_card_transactions FOR ALL
  USING (gift_card_id IN (
    SELECT id FROM public.gift_cards 
    WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

-- Create indexes for performance
CREATE INDEX idx_gift_cards_tenant ON public.gift_cards(tenant_id);
CREATE INDEX idx_gift_cards_code ON public.gift_cards(code);
CREATE INDEX idx_gift_cards_status ON public.gift_cards(status);
CREATE INDEX idx_gift_card_transactions_gift_card ON public.gift_card_transactions(gift_card_id);
CREATE INDEX idx_gift_card_designs_tenant ON public.gift_card_designs(tenant_id);

-- Function to generate unique gift card code
CREATE OR REPLACE FUNCTION public.generate_gift_card_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'GC-';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to redeem gift card
CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  p_gift_card_id UUID,
  p_amount DECIMAL,
  p_order_id UUID DEFAULT NULL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_redeemed DECIMAL;
  v_new_balance DECIMAL;
  v_status gift_card_status;
BEGIN
  -- Lock the gift card row
  SELECT current_balance, status INTO v_current_balance, v_status
  FROM gift_cards
  WHERE id = p_gift_card_id
  FOR UPDATE;
  
  -- Validate
  IF v_status != 'active' THEN
    RAISE EXCEPTION 'Gift card is not active';
  END IF;
  
  IF v_current_balance <= 0 THEN
    RAISE EXCEPTION 'Gift card has no balance';
  END IF;
  
  -- Calculate redeemed amount
  v_redeemed := LEAST(p_amount, v_current_balance);
  v_new_balance := v_current_balance - v_redeemed;
  
  -- Update gift card
  UPDATE gift_cards
  SET current_balance = v_new_balance,
      status = CASE WHEN v_new_balance <= 0 THEN 'depleted'::gift_card_status ELSE status END,
      activated_at = COALESCE(activated_at, now()),
      updated_at = now()
  WHERE id = p_gift_card_id;
  
  -- Record transaction
  INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, order_id, description)
  VALUES (p_gift_card_id, 'redeem', -v_redeemed, v_new_balance, p_order_id, 'Inwisseling bij bestelling');
  
  RETURN v_redeemed;
END;
$$;
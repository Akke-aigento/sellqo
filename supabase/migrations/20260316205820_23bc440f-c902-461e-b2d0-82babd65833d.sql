
-- Enable pgcrypto if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pos_cashiers table
CREATE TABLE public.pos_cashiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_cashiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view cashiers"
  ON public.pos_cashiers FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Tenant admins can manage cashiers"
  ON public.pos_cashiers FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE TRIGGER update_pos_cashiers_updated_at
  BEFORE UPDATE ON public.pos_cashiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add pos_cashier_id to pos_transactions
ALTER TABLE public.pos_transactions
  ADD COLUMN pos_cashier_id UUID REFERENCES public.pos_cashiers(id) ON DELETE SET NULL;

-- Hash PIN function
CREATE OR REPLACE FUNCTION public.hash_cashier_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN crypt(p_pin, gen_salt('bf'));
END;
$$;

-- Verify PIN function
CREATE OR REPLACE FUNCTION public.verify_cashier_pin(p_cashier_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_hash
  FROM public.pos_cashiers
  WHERE id = p_cashier_id AND is_active = true;
  
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

-- Create cashier function (hashes PIN server-side)
CREATE OR REPLACE FUNCTION public.create_pos_cashier(
  p_tenant_id UUID,
  p_display_name TEXT,
  p_pin TEXT,
  p_avatar_color TEXT DEFAULT '#3b82f6'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.pos_cashiers (tenant_id, display_name, pin_hash, avatar_color)
  VALUES (p_tenant_id, p_display_name, crypt(p_pin, gen_salt('bf')), p_avatar_color)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Update cashier PIN function
CREATE OR REPLACE FUNCTION public.update_cashier_pin(p_cashier_id UUID, p_new_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.pos_cashiers
  SET pin_hash = crypt(p_new_pin, gen_salt('bf')), updated_at = now()
  WHERE id = p_cashier_id;
END;
$$;

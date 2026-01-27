-- Create enum for platform payment types
CREATE TYPE public.platform_payment_type AS ENUM ('subscription', 'addon', 'ai_credits');

-- Create enum for platform payment method
CREATE TYPE public.platform_payment_method AS ENUM ('stripe', 'bank_transfer');

-- Create enum for pending payment status
CREATE TYPE public.pending_payment_status AS ENUM ('pending', 'confirmed', 'expired', 'cancelled');

-- Add new columns to platform_invoices table
ALTER TABLE public.platform_invoices
ADD COLUMN IF NOT EXISTS payment_method platform_payment_method DEFAULT 'stripe',
ADD COLUMN IF NOT EXISTS ogm_reference text,
ADD COLUMN IF NOT EXISTS payment_type platform_payment_type;

-- Create pending_platform_payments table for tracking bank transfers
CREATE TABLE public.pending_platform_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ogm_reference TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_type platform_payment_type NOT NULL,
  status pending_payment_status NOT NULL DEFAULT 'pending',
  -- For AI credits
  credits_amount INTEGER,
  package_id TEXT,
  -- For add-ons
  addon_type TEXT,
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for fast OGM lookups
CREATE INDEX idx_pending_platform_payments_ogm ON public.pending_platform_payments(ogm_reference);
CREATE INDEX idx_pending_platform_payments_tenant ON public.pending_platform_payments(tenant_id);
CREATE INDEX idx_pending_platform_payments_status ON public.pending_platform_payments(status);

-- Enable RLS
ALTER TABLE public.pending_platform_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenants can view their own pending payments
CREATE POLICY "Tenants can view own pending payments"
ON public.pending_platform_payments
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Platform admins can manage all pending payments
CREATE POLICY "Platform admins can manage all pending payments"
ON public.pending_platform_payments
FOR ALL
USING (public.is_platform_admin(auth.uid()));

-- Add SellQo platform bank settings (can be overridden via env vars)
-- This is a placeholder, actual values will come from env vars
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default bank settings placeholder
INSERT INTO public.platform_settings (id, value)
VALUES ('bank_details', '{"iban": "BE00 0000 0000 0000", "bic": "GEBABEBB", "beneficiary": "SellQo BV"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- RLS for platform_settings (read-only for authenticated users)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only platform admins can update settings"
ON public.platform_settings
FOR UPDATE
USING (public.is_platform_admin(auth.uid()));

-- Function to generate unique OGM for platform payments
CREATE OR REPLACE FUNCTION public.generate_platform_ogm()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  numeric_base TEXT;
  check_sum INTEGER;
  full_code TEXT;
  formatted TEXT;
BEGIN
  -- Use timestamp + random for uniqueness
  numeric_base := LPAD(
    (EXTRACT(EPOCH FROM now())::bigint % 10000000000)::text || 
    LPAD((random() * 999)::int::text, 3, '0'),
    10, '0'
  );
  
  -- Calculate modulo 97 checksum
  check_sum := (numeric_base::bigint % 97)::int;
  IF check_sum = 0 THEN check_sum := 97; END IF;
  
  full_code := numeric_base || LPAD(check_sum::text, 2, '0');
  formatted := '+++' || SUBSTRING(full_code, 1, 3) || '/' || 
               SUBSTRING(full_code, 4, 4) || '/' || 
               SUBSTRING(full_code, 8, 5) || '+++';
  
  RETURN formatted;
END;
$$;
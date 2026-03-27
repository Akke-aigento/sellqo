
-- Create return_status enum
CREATE TYPE public.return_status AS ENUM (
  'registered',
  'in_transit',
  'received',
  'approved',
  'rejected',
  'exchanged',
  'repaired'
);

-- Create returns table
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  marketplace_connection_id uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  marketplace_return_id varchar NOT NULL,
  marketplace_order_id varchar,
  status return_status NOT NULL DEFAULT 'registered',
  return_reason text,
  return_reason_code varchar,
  customer_name text,
  items jsonb DEFAULT '[]'::jsonb,
  handling_result varchar,
  registration_date timestamptz,
  raw_marketplace_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on marketplace_return_id per connection
ALTER TABLE public.returns ADD CONSTRAINT returns_marketplace_unique 
  UNIQUE (marketplace_connection_id, marketplace_return_id);

-- Enable RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenants can view own returns" ON public.returns
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Tenants can insert own returns" ON public.returns
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Tenants can update own returns" ON public.returns
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Service role policy for edge functions
CREATE POLICY "Service role full access returns" ON public.returns
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_returns_tenant_id ON public.returns(tenant_id);
CREATE INDEX idx_returns_connection_id ON public.returns(marketplace_connection_id);
CREATE INDEX idx_returns_status ON public.returns(status);

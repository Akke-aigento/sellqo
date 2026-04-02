
CREATE TABLE public.customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  storefront_customer_id uuid REFERENCES public.storefront_customers(id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  page_url text,
  referrer_url text,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_events_tenant ON public.customer_events(tenant_id);
CREATE INDEX idx_customer_events_customer ON public.customer_events(customer_id);
CREATE INDEX idx_customer_events_storefront_customer ON public.customer_events(storefront_customer_id);
CREATE INDEX idx_customer_events_type ON public.customer_events(event_type);
CREATE INDEX idx_customer_events_created ON public.customer_events(created_at DESC);
CREATE INDEX idx_customer_events_session ON public.customer_events(session_id);

ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own events"
  ON public.customer_events FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Service role can insert events"
  ON public.customer_events FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Anon can insert events"
  ON public.customer_events FOR INSERT
  TO anon
  WITH CHECK (true);

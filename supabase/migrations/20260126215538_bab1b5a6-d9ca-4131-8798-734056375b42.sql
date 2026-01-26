-- Bereikte milestones per tenant
CREATE TABLE public.tenant_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL, -- 'orders', 'revenue', 'customers'
  milestone_value INTEGER NOT NULL, -- 100, 1000, 10000, etc.
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shown_at TIMESTAMPTZ, -- NULL = not yet shown to user
  acknowledged_at TIMESTAMPTZ, -- When user closed the popup
  feedback_requested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, milestone_type, milestone_value)
);

-- Verdiende badges per tenant
CREATE TABLE public.tenant_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL, -- 'century_seller', 'speed_demon', etc.
  badge_name TEXT NOT NULL,
  badge_emoji TEXT NOT NULL,
  badge_description TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_order INTEGER DEFAULT 0,
  UNIQUE(tenant_id, badge_id)
);

-- App feedback (na milestones)
CREATE TABLE public.app_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  milestone_id UUID REFERENCES public.tenant_milestones(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_satisfied BOOLEAN,
  feedback_text TEXT,
  feature_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cache totals voor snelle milestone checks
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS lifetime_order_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_revenue NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_customer_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_milestone_check TIMESTAMPTZ;

-- Indexes voor performance
CREATE INDEX idx_tenant_milestones_tenant ON public.tenant_milestones(tenant_id);
CREATE INDEX idx_tenant_milestones_pending ON public.tenant_milestones(tenant_id, shown_at) WHERE shown_at IS NULL;
CREATE INDEX idx_tenant_badges_tenant ON public.tenant_badges(tenant_id);
CREATE INDEX idx_app_feedback_tenant ON public.app_feedback(tenant_id);

-- RLS Policies
ALTER TABLE public.tenant_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view milestones" ON public.tenant_milestones
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can update milestones" ON public.tenant_milestones
  FOR UPDATE USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert milestones" ON public.tenant_milestones
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can view badges" ON public.tenant_badges
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert badges" ON public.tenant_badges
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can view feedback" ON public.app_feedback
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant users can insert feedback" ON public.app_feedback
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Trigger to update lifetime stats on paid orders
CREATE OR REPLACE FUNCTION public.update_tenant_lifetime_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when payment_status becomes 'paid'
  IF NEW.payment_status = 'paid' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.tenants SET
      lifetime_order_count = COALESCE(lifetime_order_count, 0) + 1,
      lifetime_revenue = COALESCE(lifetime_revenue, 0) + COALESCE(NEW.total, 0)
    WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for orders
CREATE TRIGGER update_tenant_stats_on_order
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_tenant_lifetime_stats();

-- Trigger to update customer count
CREATE OR REPLACE FUNCTION public.update_tenant_customer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tenants SET
      lifetime_customer_count = COALESCE(lifetime_customer_count, 0) + 1
    WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_tenant_customer_count_on_insert
AFTER INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_tenant_customer_count();
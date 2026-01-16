-- =============================================
-- SellQo Platform Billing System
-- =============================================

-- 1. Pricing Plans table
CREATE TABLE public.pricing_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  
  -- Pricing
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  yearly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Stripe IDs (to be filled after creating products in Stripe)
  stripe_product_id VARCHAR(100),
  stripe_price_id_monthly VARCHAR(100),
  stripe_price_id_yearly VARCHAR(100),
  
  -- Limits (NULL = unlimited)
  limit_products INTEGER,
  limit_orders INTEGER,
  limit_customers INTEGER,
  limit_users INTEGER NOT NULL DEFAULT 1,
  limit_storage_gb INTEGER NOT NULL DEFAULT 1,
  limit_api_calls INTEGER,
  
  -- Features (JSON for flexibility)
  features JSONB NOT NULL DEFAULT '{}',
  
  -- Display
  highlighted BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seed default pricing plans
INSERT INTO public.pricing_plans (id, name, slug, monthly_price, yearly_price, limit_products, limit_orders, limit_customers, limit_users, limit_storage_gb, limit_api_calls, features, highlighted, sort_order) VALUES
('free', 'Free', 'free', 0, 0, 25, 50, 100, 1, 1, 1000, 
  '{"customDomain":false,"removeWatermark":false,"prioritySupport":false,"apiAccess":false,"webhooks":false,"advancedAnalytics":false,"whiteLabel":false,"multiCurrency":false,"facturX":false,"peppol":false}', 
  false, 1),
('starter', 'Starter', 'starter', 29, 290, 250, 500, 1000, 3, 10, 10000, 
  '{"customDomain":true,"removeWatermark":true,"prioritySupport":false,"apiAccess":true,"webhooks":true,"advancedAnalytics":false,"whiteLabel":false,"multiCurrency":false,"facturX":true,"peppol":false}', 
  false, 2),
('pro', 'Pro', 'pro', 79, 790, 2500, 5000, 10000, 10, 50, 100000, 
  '{"customDomain":true,"removeWatermark":true,"prioritySupport":true,"apiAccess":true,"webhooks":true,"advancedAnalytics":true,"whiteLabel":false,"multiCurrency":true,"facturX":true,"peppol":true}', 
  true, 3),
('enterprise', 'Enterprise', 'enterprise', 199, 1990, NULL, NULL, NULL, 50, 250, NULL, 
  '{"customDomain":true,"removeWatermark":true,"prioritySupport":true,"apiAccess":true,"webhooks":true,"advancedAnalytics":true,"whiteLabel":true,"multiCurrency":true,"facturX":true,"peppol":true}', 
  false, 4);

-- 3. Tenant Subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Plan
  plan_id VARCHAR(50) REFERENCES public.pricing_plans(id),
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
  
  -- Stripe
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_payment_method_id VARCHAR(100),
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
  
  -- Period
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  
  -- Cancellation
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  -- Payment tracking
  last_payment_date TIMESTAMP WITH TIME ZONE,
  last_payment_amount DECIMAL(10,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Platform Invoices (from SellQo to tenants)
CREATE TABLE public.platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Stripe
  stripe_invoice_id VARCHAR(100) UNIQUE,
  stripe_charge_id VARCHAR(100),
  
  -- Invoice details
  invoice_number VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  
  -- Dates
  invoice_date DATE,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Period
  period_start DATE,
  period_end DATE,
  
  -- URLs
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Admin Billing Actions log
CREATE TABLE public.admin_billing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Extend tenants table with billing fields
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_vat_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_address JSONB;

-- 7. Create indexes
CREATE INDEX idx_tenant_subscriptions_stripe ON public.tenant_subscriptions(stripe_subscription_id);
CREATE INDEX idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);
CREATE INDEX idx_platform_invoices_tenant ON public.platform_invoices(tenant_id);
CREATE INDEX idx_platform_invoices_status ON public.platform_invoices(status);
CREATE INDEX idx_admin_billing_actions_tenant ON public.admin_billing_actions(tenant_id);

-- 8. Enable RLS
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_billing_actions ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for pricing_plans (public read)
CREATE POLICY "Pricing plans are publicly readable"
  ON public.pricing_plans FOR SELECT
  USING (active = true);

CREATE POLICY "Platform admins can manage pricing plans"
  ON public.pricing_plans FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- 10. RLS Policies for tenant_subscriptions
CREATE POLICY "Tenants can view their own subscription"
  ON public.tenant_subscriptions FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Platform admins can manage all subscriptions"
  ON public.tenant_subscriptions FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- 11. RLS Policies for platform_invoices
CREATE POLICY "Tenants can view their own invoices"
  ON public.platform_invoices FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Platform admins can manage all invoices"
  ON public.platform_invoices FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- 12. RLS Policies for admin_billing_actions
CREATE POLICY "Platform admins can manage billing actions"
  ON public.admin_billing_actions FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- 13. Update trigger for tenant_subscriptions
CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 14. Update trigger for pricing_plans
CREATE TRIGGER update_pricing_plans_updated_at
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
-- Platform Coupons - Discount codes for tenants
CREATE TABLE public.platform_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_months')),
  discount_value DECIMAL(10,2) NOT NULL,
  applies_to VARCHAR(30) DEFAULT 'all' CHECK (applies_to IN ('all', 'new_tenants', 'upgrade', 'specific_plans')),
  applicable_plan_ids UUID[],
  min_subscription_months INTEGER,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  max_uses_per_tenant INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  stripe_coupon_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Coupon Redemptions - Track coupon usage
CREATE TABLE public.platform_coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.platform_coupons(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_subscriptions(id),
  discount_applied DECIMAL(10,2),
  applied_by UUID,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Quick Actions - Pre-configured admin action templates
CREATE TABLE public.platform_quick_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('gift_months', 'add_credits', 'apply_discount', 'extend_trial', 'unlock_feature')),
  action_config JSONB NOT NULL DEFAULT '{}',
  icon VARCHAR(50),
  color VARCHAR(20),
  requires_confirmation BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Loyalty Rewards - Automated rewards for milestones
CREATE TABLE public.tenant_loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('anniversary', 'milestone', 'referral', 'early_adopter', 'custom')),
  name TEXT NOT NULL,
  description TEXT,
  value JSONB NOT NULL,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_quick_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Platform admin only access
CREATE POLICY "Platform admins can manage coupons"
ON public.platform_coupons FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can manage redemptions"
ON public.platform_coupon_redemptions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can manage quick actions"
ON public.platform_quick_actions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can manage loyalty rewards"
ON public.tenant_loyalty_rewards FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);

-- Insert default quick actions
INSERT INTO public.platform_quick_actions (name, description, action_type, action_config, icon, color, sort_order) VALUES
('Welkomst Credits', 'Geef 50 AI credits als welkomstgeschenk', 'add_credits', '{"amount": 50, "reason": "Welkomst credits"}', 'Gift', 'green', 1),
('Bonus Credits', 'Geef 100 extra AI credits', 'add_credits', '{"amount": 100, "reason": "Bonus credits"}', 'Sparkles', 'blue', 2),
('Gratis Maand', 'Geef 1 maand gratis abonnement', 'gift_months', '{"months": 1}', 'Calendar', 'purple', 3),
('Churn Prevention', '3 maanden 50% korting', 'apply_discount', '{"percent": 50, "months": 3, "reason": "Churn prevention"}', 'Shield', 'orange', 4),
('Trial Verlenging', 'Verleng trial met 14 dagen', 'extend_trial', '{"days": 14}', 'Clock', 'cyan', 5),
('AI Marketing Unlock', 'Unlock AI Marketing module voor 30 dagen', 'unlock_feature', '{"feature": "module_ai_marketing", "days": 30}', 'Wand2', 'pink', 6);

-- Create updated_at trigger for platform_coupons
CREATE TRIGGER update_platform_coupons_updated_at
BEFORE UPDATE ON public.platform_coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for platform_quick_actions
CREATE TRIGGER update_platform_quick_actions_updated_at
BEFORE UPDATE ON public.platform_quick_actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
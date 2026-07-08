
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS billing_subscription_id uuid NULL REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_plan_id character varying(50) NULL REFERENCES public.pricing_plans(id),
  ADD COLUMN IF NOT EXISTS pending_interval character varying(20) NULL,
  ADD COLUMN IF NOT EXISTS pending_effective_at timestamp with time zone NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_billing_sub
  ON public.tenant_subscriptions(billing_subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_pending
  ON public.tenant_subscriptions(pending_plan_id) WHERE pending_plan_id IS NOT NULL;

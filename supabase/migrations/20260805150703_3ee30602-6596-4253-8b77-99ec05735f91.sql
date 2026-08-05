-- UPGRADE-PF-1: pay-first upgrades via proration billing cycles.

-- 1. Cycle type
DO $$ BEGIN
  CREATE TYPE public.billing_cycle_type AS ENUM ('recurring', 'proration');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS cycle_type public.billing_cycle_type NOT NULL DEFAULT 'recurring';

-- 2. Target plan for a proration cycle (pricing_plans.id is varchar, e.g. 'pro')
ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS target_plan_id character varying REFERENCES public.pricing_plans(id);
ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS target_interval text;
ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS description text;

-- 3. Cancelled status (aborting an unpaid upgrade)
ALTER TYPE public.billing_cycle_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 4. Pending upgrade pointer on the tenant subscription
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS pending_billing_cycle_id uuid
  REFERENCES public.billing_cycles(id) ON DELETE SET NULL;

-- 5. Indexes: additive first, then narrow the old one.
--    The (subscription_id, period_start) uniqueness is the runner's idempotency
--    guard for RECURRING periods only — a proration cycle starting today must
--    never collide with the period cycle of the same day.
CREATE UNIQUE INDEX IF NOT EXISTS billing_cycles_sub_period_recurring_key
  ON public.billing_cycles (subscription_id, period_start)
  WHERE cycle_type = 'recurring';

DROP INDEX IF EXISTS public.billing_cycles_sub_period_key;

-- At most one open proration cycle per subscription (409 guard in sync-tenant-plan).
CREATE UNIQUE INDEX IF NOT EXISTS billing_cycles_open_proration_key
  ON public.billing_cycles (subscription_id)
  WHERE cycle_type = 'proration'
    AND status IN ('pending', 'awaiting_payment', 'processing', 'reopened');

CREATE INDEX IF NOT EXISTS billing_cycles_proration_idx
  ON public.billing_cycles (subscription_id, cycle_type, status);
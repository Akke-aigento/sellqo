-- Add column to track when trial expiry warning was sent
ALTER TABLE public.tenant_subscriptions 
ADD COLUMN IF NOT EXISTS trial_warning_sent_at timestamptz DEFAULT NULL;
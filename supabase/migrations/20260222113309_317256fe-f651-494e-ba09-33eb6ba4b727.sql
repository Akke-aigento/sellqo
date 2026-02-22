ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS oss_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oss_threshold_reached boolean DEFAULT false;
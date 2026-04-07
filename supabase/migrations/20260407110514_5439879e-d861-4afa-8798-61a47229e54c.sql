ALTER TABLE public.tenant_feature_overrides 
ADD COLUMN IF NOT EXISTS granted_features text[] DEFAULT '{}';
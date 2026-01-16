-- Add OSS registration fields to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS oss_registration_date DATE,
ADD COLUMN IF NOT EXISTS oss_identification_number TEXT;
-- Add onboarding_data column to store wizard state between sessions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
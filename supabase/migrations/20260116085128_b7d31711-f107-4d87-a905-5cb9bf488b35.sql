-- Add language preference column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl';

COMMENT ON COLUMN public.profiles.language IS 'User preferred interface language (nl, en, de, fr)';
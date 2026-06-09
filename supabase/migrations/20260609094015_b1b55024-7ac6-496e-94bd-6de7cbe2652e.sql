-- Hoofdstuk 5 — Cleanup post-merge: drop legacy helpers
-- Verified: 0 policies reference has_role(uuid, app_role) or get_user_role(uuid)
-- Verified: 0 code references in supabase/functions or src
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
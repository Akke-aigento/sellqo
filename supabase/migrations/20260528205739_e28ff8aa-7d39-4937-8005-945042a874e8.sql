CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

DROP POLICY IF EXISTS "Users can view their own invitations" ON public.team_invitations;

CREATE POLICY "Users can view their own invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (
  LOWER(email) = LOWER(COALESCE(public.get_current_user_email(), ''))
);
CREATE POLICY "Anyone can view invitation by token"
ON public.team_invitations
FOR SELECT
TO anon, authenticated
USING (true);
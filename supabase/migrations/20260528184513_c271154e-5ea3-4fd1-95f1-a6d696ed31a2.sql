ALTER TABLE public.team_invitations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
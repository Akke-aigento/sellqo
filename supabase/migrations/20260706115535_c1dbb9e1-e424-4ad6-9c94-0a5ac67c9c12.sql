DELETE FROM public.invite_audit_log WHERE invitation_id = '48edba58-bcc8-48cb-98df-01b40a938772';
DELETE FROM public.team_invitations WHERE id = '48edba58-bcc8-48cb-98df-01b40a938772';
DELETE FROM auth.users WHERE id = '8e4cf41a-9546-4754-b902-aa6d404e4601';
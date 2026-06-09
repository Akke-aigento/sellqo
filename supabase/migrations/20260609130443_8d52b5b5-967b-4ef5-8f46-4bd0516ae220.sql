-- Batch INV-1: Team-invite schema + audit-log infrastructuur

-- 1) Enum
CREATE TYPE public.invite_status AS ENUM (
  'pending', 'accepted', 'expired', 'revoked', 'rejected'
);

-- 2) Extend team_invitations
ALTER TABLE public.team_invitations
  ADD COLUMN status public.invite_status NOT NULL DEFAULT 'pending',
  ADD COLUMN last_reminder_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN revoked_at TIMESTAMPTZ NULL,
  ADD COLUMN revoked_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.team_invitations SET status = 'accepted' WHERE accepted_at IS NOT NULL;
UPDATE public.team_invitations SET status = 'expired'
  WHERE accepted_at IS NULL AND expires_at < NOW();

-- 3) pg_cron auto-expiry job (pg_cron already enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-invitations') THEN
    PERFORM cron.unschedule('expire-invitations');
  END IF;
  PERFORM cron.schedule(
    'expire-invitations',
    '0 3 * * *',
    $cron$
      UPDATE public.team_invitations
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < NOW()
    $cron$
  );
END $$;

-- 4) Audit log table
CREATE TABLE public.invite_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.team_invitations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent', 'accepted', 'rejected', 'expired', 'revoked', 'reminded', 'resent'
  )),
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT ON public.invite_audit_log TO authenticated;
GRANT ALL ON public.invite_audit_log TO service_role;

CREATE INDEX idx_invite_audit_log_invitation ON public.invite_audit_log(invitation_id);
CREATE INDEX idx_invite_audit_log_tenant ON public.invite_audit_log(tenant_id);
CREATE INDEX idx_invite_audit_log_created ON public.invite_audit_log(created_at DESC);

ALTER TABLE public.invite_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_select_invite_audit" ON public.invite_audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

CREATE POLICY "platform_admin_select_invite_audit" ON public.invite_audit_log
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 5) Platform admin read policy on team_invitations
DROP POLICY IF EXISTS "platform_admin_select_invitations" ON public.team_invitations;
CREATE POLICY "platform_admin_select_invitations" ON public.team_invitations
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 6) Helper: effective status (defensive)
CREATE OR REPLACE FUNCTION public.get_invitation_effective_status(inv_id UUID)
RETURNS public.invite_status
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.invite_status;
  v_expires_at TIMESTAMPTZ;
  v_accepted_at TIMESTAMPTZ;
BEGIN
  SELECT status, expires_at, accepted_at
    INTO v_status, v_expires_at, v_accepted_at
  FROM public.team_invitations WHERE id = inv_id;

  IF v_accepted_at IS NOT NULL THEN RETURN 'accepted'::public.invite_status; END IF;
  IF v_status = 'revoked' THEN RETURN 'revoked'::public.invite_status; END IF;
  IF v_status = 'rejected' THEN RETURN 'rejected'::public.invite_status; END IF;
  IF v_expires_at < NOW() THEN RETURN 'expired'::public.invite_status; END IF;
  RETURN 'pending'::public.invite_status;
END;
$$;
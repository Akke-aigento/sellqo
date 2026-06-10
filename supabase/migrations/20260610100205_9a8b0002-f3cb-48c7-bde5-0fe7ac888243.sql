-- Cleanup orphan spoof-user (aaron.mercken@hotmail.com) en koppel Sander
-- aan Mancini Milano als tenant_admin. Alles transactioneel.

-- 1. Sander als tenant_admin op Mancini (idempotent)
INSERT INTO public.user_roles (user_id, tenant_id, role)
VALUES (
  'a183cd15-851c-47fc-9d97-f08a10ae6eeb',
  '2606c5b9-caf8-4a42-94cd-80e3f3f31988',
  'tenant_admin'
)
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- 2. Orphan z'n role op Mancini weg
DELETE FROM public.user_roles
WHERE user_id = 'd020b521-0ab1-40cc-a13c-614cb879ae6d'
  AND tenant_id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988';

-- 3. Owner-email corrigeren — voorkomt dat repair-tenant-access
--    opnieuw aan een willekeurige aaron-mercken signup admin toekent
UPDATE public.tenants
SET owner_email = 'info@mancinimilano.com'
WHERE id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988'
  AND owner_email = 'aaron.mercken@hotmail.com';

-- 4. Pending invites van de orphan revoken
UPDATE public.team_invitations
SET status = 'revoked',
    revoked_at = NOW(),
    revoked_by = (SELECT id FROM auth.users WHERE email = 'info@sellqo.app' LIMIT 1)
WHERE email = 'aaron.mercken@hotmail.com'
  AND status = 'pending';

-- 5. Audit-log voor de revoke
INSERT INTO public.invite_audit_log (invitation_id, tenant_id, event_type,
  actor_user_id, metadata)
SELECT id, tenant_id, 'revoked',
  (SELECT id FROM auth.users WHERE email = 'info@sellqo.app' LIMIT 1),
  jsonb_build_object('reason', 'orphan_spoof_cleanup_2026_06_10')
FROM public.team_invitations
WHERE email = 'aaron.mercken@hotmail.com'
  AND status = 'revoked'
  AND revoked_at >= NOW() - INTERVAL '1 minute';

-- 6. Orphan auth.users row weg (cascade naar profiles + overige user_roles)
DELETE FROM auth.users
WHERE id = 'd020b521-0ab1-40cc-a13c-614cb879ae6d';

-- 7. Pre-COMMIT verificatie — RAISE EXCEPTION rolt de hele migration terug
DO $$
DECLARE
  v_orphan_exists BOOLEAN;
  v_sander_has_mancini_admin BOOLEAN;
  v_mancini_admin_count INT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = 'd020b521-0ab1-40cc-a13c-614cb879ae6d')
    INTO v_orphan_exists;
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = 'a183cd15-851c-47fc-9d97-f08a10ae6eeb'
      AND tenant_id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988'
      AND role = 'tenant_admin'
  ) INTO v_sander_has_mancini_admin;
  SELECT COUNT(*) FROM public.user_roles
    WHERE tenant_id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988'
      AND role = 'tenant_admin'
    INTO v_mancini_admin_count;

  IF v_orphan_exists THEN
    RAISE EXCEPTION 'Orphan auth.users row nog aanwezig — rollback';
  END IF;
  IF NOT v_sander_has_mancini_admin THEN
    RAISE EXCEPTION 'Sander heeft geen tenant_admin role op Mancini — rollback';
  END IF;
  IF v_mancini_admin_count < 1 THEN
    RAISE EXCEPTION 'Mancini heeft geen tenant_admin meer — rollback';
  END IF;
END $$;
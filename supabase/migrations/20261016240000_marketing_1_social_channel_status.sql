-- MARKETING-1 — status van de social-koppelingen voor iedereen die posts beheert.
--
-- social_connections is enkel leesbaar voor tenant_admin (de rij bevat access_token). Gevolg:
-- een gebruiker met de rol marketing zag in de Social planning altijd "geen koppeling" en kon
-- zijn kanalen nergens zien. Deze functie geeft enkel de niet-geheime velden terug, voor
-- tenant_admin, staff en marketing van die winkel (en platformbeheerders).
--
-- Additief: geen policy op social_connections gewijzigd, tokens blijven afgeschermd.
-- Idempotent (CREATE OR REPLACE).
-- Terugdraaien: drop function if exists public.social_connection_status(uuid);

CREATE OR REPLACE FUNCTION public.social_connection_status(p_tenant uuid)
RETURNS TABLE (
  id uuid,
  platform text,
  api_kind text,
  account_name text,
  account_avatar text,
  is_active boolean,
  token_expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_tenant_role(p_tenant, ARRAY['tenant_admin', 'staff', 'marketing']::app_role[])
    OR is_platform_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.platform, c.api_kind, c.account_name, c.account_avatar, c.is_active, c.token_expires_at, c.updated_at
    FROM social_connections c
    WHERE c.tenant_id = p_tenant
    ORDER BY c.platform;
END;
$$;

REVOKE ALL ON FUNCTION public.social_connection_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.social_connection_status(uuid) TO authenticated;

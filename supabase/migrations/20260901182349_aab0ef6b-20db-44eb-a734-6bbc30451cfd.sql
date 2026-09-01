-- Tenant action links: deelbare, lang-levende links op eigen domein voor
-- onboarding-acties (Stripe Connect onboarding, SEPA-machtiging).
--
-- Handmatig terugdraaien (geen DOWN-migratie):
--   DROP TABLE IF EXISTS public.tenant_action_tokens;
--   DROP TYPE IF EXISTS public.tenant_action_status;
--   DROP TYPE IF EXISTS public.tenant_action_type;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_action_type') THEN
    CREATE TYPE public.tenant_action_type AS ENUM ('connect_onboarding', 'sepa_mandate');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_action_status') THEN
    CREATE TYPE public.tenant_action_status AS ENUM ('pending', 'completed', 'expired', 'revoked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_type public.tenant_action_type NOT NULL,
  token text NOT NULL UNIQUE,
  status public.tenant_action_status NOT NULL DEFAULT 'pending',
  context jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.tenant_action_tokens TO authenticated;
GRANT ALL ON public.tenant_action_tokens TO service_role;

ALTER TABLE public.tenant_action_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_action_tokens'
      AND policyname = 'Platform admins can view tenant action tokens'
  ) THEN
    CREATE POLICY "Platform admins can view tenant action tokens"
      ON public.tenant_action_tokens
      FOR SELECT
      TO authenticated
      USING (public.is_platform_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_action_tokens'
      AND policyname = 'Platform admins can create tenant action tokens'
  ) THEN
    CREATE POLICY "Platform admins can create tenant action tokens"
      ON public.tenant_action_tokens
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_platform_admin(auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_action_tokens_token
  ON public.tenant_action_tokens (token);

CREATE INDEX IF NOT EXISTS idx_tenant_action_tokens_tenant_status
  ON public.tenant_action_tokens (tenant_id, status);
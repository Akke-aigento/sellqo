-- Phase 1, Batch 1A (addendum): platform_settings lockdown to platform_admin only.
-- Current state: SELECT policy "Anyone can read platform settings" USING(true) exposes
-- sensitive platform data (e.g. bank_details with IBAN/BIC) to every authenticated user.

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

CREATE POLICY "Platform admins can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Tighten grants: no anon access; authenticated reads gated by the policy above; writes are platform-admin via existing UPDATE policy. service_role retains full access for edge functions.
REVOKE ALL ON public.platform_settings FROM anon;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

COMMENT ON TABLE public.platform_settings IS 'Platform-admin only. Bevat gevoelige SellQo-bedrijfsdata (bv. bank_details). Bij toevoegen van publiek-leesbare keys: NIET deze policy versoepelen, maar splitsen naar platform_settings_public.';
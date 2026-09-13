-- PUSH-2 — pushvoorkeuren per gebruiker in plaats van per winkel.
--
-- WAAROM. PUSH-1 (13 sep 2026) zette de pushschakelaar op
-- tenant_notification_settings.push_enabled — de kolom die er al stond. Maar
-- push is persoonlijk: het is iemands telefoon. In dat model zette de eigenaar
-- push aan voor bestellingen en trilde de telefoon van de magazijnmedewerker en
-- de boekhouder mee.
--
-- Twee dingen uit de live database die dit onderbouwen (nagetrokken 13 sep):
--   * VanXcel had push aan voor alle 9 bestellingstypes, en geen van de drie
--     VanXcel-gebruikers had een toestel. De instellingen bereikten niemand.
--   * Een platform-admin heeft tenant_id NULL, en send-push-notification koos
--     ontvangers via user_roles.tenant_id. Wie als platform-admin een klantwinkel
--     bekeek en de schakelaar omzette, viel zelf buiten de ontvangers.
--
-- ALLEEN push_enabled. E-mail gaat naar een winkeladres ("eigenaar" of een
-- alternatief adres) en in-app is weinig opdringerig; die blijven op
-- tenant_notification_settings. Geen kolommen toevoegen voor kanalen die hier
-- niet horen.
--
-- PATROON. Hetzelfde als sidebar_preferences, dashboard_preferences en
-- user_label_preferences: user_id + tenant_id, RLS op auth.uid().
--
-- DE OUDE KOLOM BLIJFT. tenant_notification_settings.push_enabled wordt niet
-- meer gelezen, maar niet gedropt: droppen is onomkeerbaar en hoort niet bij het
-- opruimen van een functie. De bestaande rijen met push_enabled = true worden
-- NIET overgezet — ze bereikten niemand, en omzetten naar "iedereen met een rol"
-- zou precies het probleem terugbrengen dat deze migratie oplost.
--
-- Idempotent: IF NOT EXISTS op tabel en index, DROP ... IF EXISTS vóór elke
-- CREATE TRIGGER en CREATE POLICY.
--
-- Handmatig terugdraaien:
--   DROP TABLE IF EXISTS public.user_notification_preferences;
-- (send-push-notification leest dan niets meer en stuurt geen push.)

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL,
  notification_type text NOT NULL,
  push_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notification_preferences_unique
    UNIQUE (user_id, tenant_id, category, notification_type)
);

-- send-push-notification zoekt op (tenant_id, category, notification_type) met
-- push_enabled = true. De unieke index begint met user_id en helpt daar niet.
CREATE INDEX IF NOT EXISTS user_notification_preferences_lookup
  ON public.user_notification_preferences (tenant_id, category, notification_type)
  WHERE push_enabled;

-- Zelfde triggerfunctie als sidebar_preferences en dashboard_preferences.
DROP TRIGGER IF EXISTS update_user_notification_preferences_updated_at
  ON public.user_notification_preferences;
CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Lezen: alleen je eigen voorkeuren.
DROP POLICY IF EXISTS "unp_select_own" ON public.user_notification_preferences;
CREATE POLICY "unp_select_own" ON public.user_notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Schrijven: je eigen voorkeuren, en alleen voor een winkel waar je bij hoort.
-- Zonder die tweede regel kon iedereen zich abonneren op meldingen van een
-- willekeurige winkel waarvan hij het id kent. Een platform-admin mag elke
-- winkel (keuze van Akke, 13 sep 2026). Beide helpers zijn SECURITY DEFINER.
DROP POLICY IF EXISTS "unp_insert_own" ON public.user_notification_preferences;
CREATE POLICY "unp_insert_own" ON public.user_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      OR public.is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "unp_update_own" ON public.user_notification_preferences;
CREATE POLICY "unp_update_own" ON public.user_notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      OR public.is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "unp_delete_own" ON public.user_notification_preferences;
CREATE POLICY "unp_delete_own" ON public.user_notification_preferences
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
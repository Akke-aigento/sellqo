-- APP-INBOX-CRASH-1 — platform_admin-toegang tot ai_assistant_config,
-- opruimen dubbele inbound, unieke index op resend_id.
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector
-- (duplicaat-les). Idempotent: een tweede run verandert niets.
-- Volgorde verplicht: deel 2 (opruimen) vóór deel 3 (index), anders faalt
-- CREATE UNIQUE INDEX op het bestaande duplicaat.

-- ─────────────────────────────────────────────────────────────────────
-- Deel 1 — RLS ai_assistant_config: platform_admin mag elke winkel.
--
-- De bestaande policies kijken naar user_roles.tenant_id; de platform_admin-
-- rij heeft tenant_id NULL, dus 'platform_admin' in die ARRAY hielp nooit.
-- Strikt additief: drie NIEUWE policies naast de bestaande, via de helper
-- is_platform_admin(uuid) (zoals ~70 migraties). Bestaande policies ongemoeid.
--
-- Terugdraaien: DROP POLICY van de drie namen hieronder.
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Platform admins can view config" ON public.ai_assistant_config;
CREATE POLICY "Platform admins can view config"
  ON public.ai_assistant_config FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can insert config" ON public.ai_assistant_config;
CREATE POLICY "Platform admins can insert config"
  ON public.ai_assistant_config FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can update config" ON public.ai_assistant_config;
CREATE POLICY "Platform admins can update config"
  ON public.ai_assistant_config FOR UPDATE
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Controle:
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ai_assistant_config' ORDER BY cmd, policyname;

-- ─────────────────────────────────────────────────────────────────────
-- Deel 2 — dubbele inbound "Test 3 inbound" (VanXcel, 18-09) opruimen.
--
-- Stand 18-09 (read-only gecontroleerd): één paar met resend_id
-- d92eab7d-29c7-4dd0-b3ed-00dc99d789e8 —
--   eff89884-80d3-4860-9565-931abd444168  13:11:58  (origineel, blijft)
--   a609efb8-3344-47dd-80a2-6552cc315065  13:19:13  (replay, weg)
-- Melding van de replay: 0cfd1867-802c-4b35-8666-389805970fb8 (weg).
-- Geen bijlagen, geen ai_reply_suggestions, geen reply_message_id-verwijzing
-- naar a609efb8 (FK's: attachments en suggestions CASCADE, reply NO ACTION).
--
-- Terugdraaien: de snapshot hieronder bewaren; terugzetten = INSERT van die rijen.
-- ─────────────────────────────────────────────────────────────────────

-- Snapshot vóór het opruimen:
SELECT * FROM public.customer_messages
WHERE id IN ('eff89884-80d3-4860-9565-931abd444168', 'a609efb8-3344-47dd-80a2-6552cc315065');

SELECT * FROM public.notifications
WHERE id IN ('6b143e79-48fd-49d7-bc5b-6f47eeb66b9a', '0cfd1867-802c-4b35-8666-389805970fb8');

-- Controle vóór het opruimen: er mag geen ander duplicaat zijn (verwacht: 1 rij, n = 2).
SELECT resend_id, count(*) AS n
FROM public.customer_messages
WHERE direction = 'inbound' AND resend_id IS NOT NULL
GROUP BY resend_id HAVING count(*) > 1;

DELETE FROM public.notifications
WHERE id = '0cfd1867-802c-4b35-8666-389805970fb8'
  AND tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
  AND data->>'message_id' = 'a609efb8-3344-47dd-80a2-6552cc315065'
RETURNING id;

DELETE FROM public.customer_messages
WHERE id = 'a609efb8-3344-47dd-80a2-6552cc315065'
  AND tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
  AND direction = 'inbound'
  AND resend_id = 'd92eab7d-29c7-4dd0-b3ed-00dc99d789e8'
RETURNING id;

-- ─────────────────────────────────────────────────────────────────────
-- Deel 3 — unieke partiële index: een replay kan nooit meer een tweede rij
-- geven, ook niet bij twee gelijktijdige webhook-aanroepen.
-- handle-inbound-email vangt de 23505 op als duplicaat.
--
-- Terugdraaien: DROP INDEX IF EXISTS public.customer_messages_inbound_resend_id_key;
-- ─────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS customer_messages_inbound_resend_id_key
  ON public.customer_messages (resend_id)
  WHERE direction = 'inbound' AND resend_id IS NOT NULL;

-- Controle (verwacht: 0 rijen):
SELECT resend_id, count(*) AS n
FROM public.customer_messages
WHERE direction = 'inbound' AND resend_id IS NOT NULL
GROUP BY resend_id HAVING count(*) > 1;

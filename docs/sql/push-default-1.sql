-- PUSH-DEFAULT-1 — eenmalige datacorrectie na "meldingen standaard aan".
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector, ná een
-- snapshot (zie hieronder). Idempotent: een tweede keer raakt 0 rijen.
--
-- Stand 18-09-2026 (read-only gecontroleerd): VanXcel heeft vijf rijen in
-- categorie `messages` (bol_inbound, email_inbound, facebook_inbound,
-- instagram_inbound, whatsapp_inbound), alle met email_enabled = false. Een
-- expliciete rij wint van de nieuwe default, dus zonder deze update zou
-- VanXcel bij berichten nog steeds geen mail krijgen. contact_form_inbound
-- heeft geen rij en volgt vanzelf de nieuwe default (aan).
--
-- 6a (push = aan op tenant_notification_settings voor VanXcel + SellQo)
-- VERVALT: Akke koos 18-09 voor alleen de gebruikerslaag. send-push-notification
-- leest tenant_notification_settings.push_enabled niet (sinds PUSH-2); die
-- kolom omzetten doet niets. Push volgt nu user_notification_preferences, en
-- zonder rij staat push aan voor iedereen met een rol in de winkel.
--
-- Terugdraaien: dezelfde UPDATE met email_enabled = false voor de id's uit de
-- snapshot.

-- Snapshot vóór de update:
SELECT id, notification_type, email_enabled
FROM public.tenant_notification_settings
WHERE tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
  AND category = 'messages';

-- 6b — e-mail bij berichten aan voor VanXcel:
UPDATE public.tenant_notification_settings
SET email_enabled = true
WHERE tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
  AND category = 'messages'
  AND email_enabled = false
RETURNING id, notification_type, email_enabled;

-- WEBPUSH-1 (10 okt 2026): web push voor de SellQo-webapp.
--
-- Een web-abonnement leeft in dezelfde tabel als de native FCM-tokens, met
-- platform = 'web' (de check-constraint kent 'web' al sinds de aanmaak).
-- `token` bevat voor web het push-endpoint (uniek, zoals bij FCM-tokens);
-- de twee sleutels van het abonnement komen in eigen kolommen.
--
-- `os` (ios / android / desktop) is nodig om dubbele meldingen te vermijden:
-- de webapp waarschuwt als er al een native app van hetzelfde besturings-
-- systeem actief is, en de native app biedt aan om web-meldingen van hetzelfde
-- OS uit te zetten. Een server kan niet zien dat twee abonnementen op dezelfde
-- telefoon staan; de gebruiker bevestigt dat.
--
-- Strikt additief, idempotent, geen RLS-wijziging (de bestaande policies
-- beperken alles al tot auth.uid() = user_id).
--
-- Terugdraaien (handmatig, alleen als er geen web-rijen meer zijn):
--   DELETE FROM public.device_tokens WHERE platform = 'web';
--   ALTER TABLE public.device_tokens DROP COLUMN IF EXISTS p256dh,
--     DROP COLUMN IF EXISTS auth, DROP COLUMN IF EXISTS os;

ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS p256dh text NULL,
  ADD COLUMN IF NOT EXISTS auth text NULL,
  ADD COLUMN IF NOT EXISTS os text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.device_tokens'::regclass
      AND conname = 'device_tokens_web_keys_check'
  ) THEN
    ALTER TABLE public.device_tokens
      ADD CONSTRAINT device_tokens_web_keys_check
      CHECK (platform <> 'web' OR (p256dh IS NOT NULL AND auth IS NOT NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.device_tokens.p256dh IS 'WEBPUSH-1: publieke sleutel van het web-push-abonnement (alleen platform=web).';
COMMENT ON COLUMN public.device_tokens.auth IS 'WEBPUSH-1: auth-secret van het web-push-abonnement (alleen platform=web).';
COMMENT ON COLUMN public.device_tokens.os IS 'WEBPUSH-1: ios / android / desktop — voor de dubbele-melding-check tussen web en native.';

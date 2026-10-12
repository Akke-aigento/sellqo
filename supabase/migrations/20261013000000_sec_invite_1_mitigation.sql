-- SEC-INVITE-1 — TIJDELIJKE mitigatie (13-10-2026), tot de functie-fix live staat.
--
-- create-invite-account (oude live versie) zet met een geldig uitnodigingstoken het
-- wachtwoord van een BESTAAND account met dat e-mailadres. De fix (commit 9c2d4a2)
-- staat op main, maar kon niet gedeployed worden: de Lovable-workspace had geen
-- credits meer. Zonder uitnodiging naar het e-mailadres van een bestaand account
-- is het lek niet te misbruiken, dus die blokkeren we hier, voor elk pad: de
-- service-role-insert van send-team-invitation, een rechtstreekse insert via RLS,
-- het achteraf wijzigen van het e-mailadres, en het heropwekken van een oude
-- (ingetrokken/verlopen/aanvaarde) uitnodiging naar een bestaand account.
--
-- Bijwerking: bestaande SellQo-gebruikers kunnen tijdelijk niet in een (ander) team
-- uitgenodigd worden. Nieuwe e-mailadressen werken gewoon.
--
-- OPRUIMEN zodra create-invite-account met versiestempel "SEC-INVITE-1" live staat:
--   DROP TRIGGER sec_invite_block_existing_accounts ON public.team_invitations;
--   DROP FUNCTION public.sec_invite_block_existing_accounts();

CREATE OR REPLACE FUNCTION public.sec_invite_block_existing_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Alleen relevant als de rij hierdoor BRUIKBAAR wordt voor create-invite-account
  -- (exact diens check: niet aanvaard, niet revoked/rejected, niet verlopen): bij een
  -- nieuwe uitnodiging, een gewijzigd e-mailadres, of het heropwekken van een oude
  -- (ingetrokken/verlopen/aanvaarde) uitnodiging. Aanvaarden en intrekken blijven vrij.
  IF TG_OP = 'UPDATE'
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NOT (
       (NEW.accepted_at IS NULL AND NEW.status::text NOT IN ('revoked', 'rejected') AND NEW.expires_at > now())
       AND NOT (OLD.accepted_at IS NULL AND OLD.status::text NOT IN ('revoked', 'rejected') AND OLD.expires_at > now())
     )
  THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Deze persoon heeft al een SellQo-account. Bestaande accounts uitnodigen is tijdelijk uitgeschakeld wegens beveiligingsonderhoud; probeer het later opnieuw.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sec_invite_block_existing_accounts ON public.team_invitations;
CREATE TRIGGER sec_invite_block_existing_accounts
  BEFORE INSERT OR UPDATE ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.sec_invite_block_existing_accounts();

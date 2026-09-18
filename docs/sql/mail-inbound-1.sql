-- MAIL-INBOUND-1 — inkomende mail standaard aan, en aan voor de bestaande winkels.
--
-- BEWUST GEEN MIGRATIE in supabase/migrations/: chat-Claude voert dit uit via de
-- connector, na een snapshot van tenants (id, name, inbound_email_prefix,
-- inbound_email_enabled). Een migratie ernaast zou dubbel draaien (duplicaat-les).
--
-- Waarom aan: sinds MAIL-INBOUND-1 komt klantmail via <prefix>@mail.sellqo.app
-- echt binnen (Resend). handle-inbound-email slaat een mail op ongeacht deze vlag;
-- de vlag bepaalt vooral wat de admin toont. Een winkel die antwoorden van klanten
-- verwacht, hoort hem aan te zien staan.
--
-- Terugdraaien:
--   ALTER TABLE public.tenants ALTER COLUMN inbound_email_enabled SET DEFAULT false;
--   UPDATE public.tenants SET inbound_email_enabled = false WHERE id IN (<zelfde lijst>);

ALTER TABLE public.tenants ALTER COLUMN inbound_email_enabled SET DEFAULT true;

UPDATE public.tenants
SET inbound_email_enabled = true
WHERE inbound_email_prefix IS NOT NULL
  AND inbound_email_enabled = false
  AND id IN (
    -- PLACEHOLDER: de vaste lijst van 9 tenant-id's, aangeleverd door chat-Claude
    -- bij uitvoering, na snapshot. NIET invullen uit het hoofd.
  )
RETURNING id, name, inbound_email_enabled;

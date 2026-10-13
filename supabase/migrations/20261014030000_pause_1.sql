-- PAUSE-1 — online bestellingen even pauzeren (druk in de keuken) en sluitingsdagen.
-- paused_until: tot wanneer afhalen/leveren geen nieuwe bestellingen aanneemt (null = niet gepauzeerd).
-- closed_dates: datums (lokale kalenderdag) waarop de zaak dicht is (vakantie, feestdag).
-- Bestellen aan tafel (QR) blijft gewoon werken: de gasten zitten al in de zaak.
alter table public.fulfillment_settings
  add column if not exists paused_until timestamptz,
  add column if not exists closed_dates date[] not null default '{}';

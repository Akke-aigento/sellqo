-- VASTE-KLANT-1 — vaste klanten als vaste plek op het zaalplan.
-- 1. dining_tables.kind krijgt 'regular' (vaste klant). Een bestaande rij verandert niet.
-- 2. Label: tot 20 tekens, met letters met accenten en een apostrof ("Bompa Ré", "O'Neill"),
--    geldt voor alle soorten. Strikt ruimer: elk bestaand label blijft geldig.
-- Idempotent (constraint droppen en opnieuw toevoegen). Handmatig terugdraaien: de oude checks
--   kind in ('table','bar_seat','standing') en label ~ '^[A-Za-z0-9][A-Za-z0-9 _./-]{0,15}$'
--   terugzetten (lukt enkel als er geen rij 'regular' of geen nieuw label meer bestaat).
alter table public.dining_tables drop constraint if exists dining_tables_kind_check;
alter table public.dining_tables add constraint dining_tables_kind_check
  check (kind in ('table', 'bar_seat', 'standing', 'regular'));

alter table public.dining_tables drop constraint if exists dining_tables_label_check;
alter table public.dining_tables add constraint dining_tables_label_check
  check (label ~ '^[[:alnum:]][[:alnum:] _./''-]{0,19}$');

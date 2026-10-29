-- ONDERBALK-1 — iedereen kiest zelf de snelkoppelingen in de onderbalk op de gsm (Instellingen › Mijn onderbalk).
--
-- Per persoon en per zaak, in dezelfde rij als "Menu aanpassen" (sidebar_preferences: eigen rij, eigen RLS
-- op user_id). bottom_nav = menu-item-id's in volgorde (sidebarConfig); null of leeg = de standaard van het
-- spoor. Hoogstens 5 (de pil op een gsm). Additief; sidebar_preferences is geen gedeelde storefront-tabel.
-- Terugdraaien (handmatig): alter table public.sidebar_preferences drop column if exists bottom_nav;

alter table public.sidebar_preferences add column if not exists bottom_nav text[];
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.sidebar_preferences'::regclass and conname = 'sidebar_preferences_bottom_nav_check') then
    alter table public.sidebar_preferences add constraint sidebar_preferences_bottom_nav_check
      check (bottom_nav is null or (cardinality(bottom_nav) <= 5 and array_position(bottom_nav, null) is null));
  end if;
end
$mig$;
comment on column public.sidebar_preferences.bottom_nav is 'ONDERBALK-1: snelkoppelingen in de gsm-onderbalk (menu-item-id''s, volgorde). Null = standaard van het spoor.';

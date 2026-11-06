-- MENUKAART-PRINT-1 — de papieren menukaart (Kaart › Afdrukken): gekozen sjabloon, opties en
-- kaftfoto per zaak, zodat de zaak het niet telkens opnieuw kiest, ook niet op een ander toestel.
--
-- Waarom een eigen tabel: geen bestaande jsonb-kolom past. tenant_theme_settings stroomt via
-- select('*') in storefront-api naar alle eigen frontends (eerste wet); fulfillment_settings wordt
-- in storefront-api met select('*') gelezen en is enkel door de zaakvoerder te wijzigen;
-- horeca_pay_settings hoort bij de kassa (betalen). Deze tabel wordt door geen enkele edge
-- function gelezen: enkel het beheer (MenuPrintDialog / useMenuPrintSettings).
--
-- Niets gevoeligs: een sjabloonnaam, schakelaars, een ondertitel, een taalcode en de publieke URL
-- van een afbeelding (zoals products.featured_image; geen signed URL, R1).
--
-- Rechten: lezen = elk lid van de zaak; schrijven = zaakvoerder en medewerker (zoals de kaart_*-
-- functies; platform_admin via has_tenant_role). Geen delete: de standaard geldt zonder rij.
-- Het beheer valt terug op localStorage zolang deze migratie niet gedraaid is.
--
-- Idempotent (if not exists / drop policy if exists). Handmatig terugdraaien:
--   drop table if exists public.menu_print_settings;

create table if not exists public.menu_print_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  template text not null default 'booklet_a5' check (template in ('booklet_a5', 'a4', 'photo_cover')),
  -- { descriptions, allergens, info, qr: boolean; subtitle: text (≤ 60); language: taalcode }
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  cover_image_url text check (cover_image_url is null or (cover_image_url ~ '^https://' and length(cover_image_url) <= 2000)),
  updated_at timestamptz not null default now()
);
-- Begrensde grootte van options (review MENUKAART-PRINT-1): idempotent toegevoegd.
do $c$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.menu_print_settings'::regclass and conname = 'menu_print_settings_options_size') then
    alter table public.menu_print_settings add constraint menu_print_settings_options_size check (pg_column_size(options) < 4096);
  end if;
end
$c$;
comment on table public.menu_print_settings is 'MENUKAART-PRINT-1: sjabloon, opties en kaftfoto van de papieren menukaart per zaak (Kaart › Afdrukken). Enkel beheer, niet in storefront-api.';

revoke all on public.menu_print_settings from anon;
grant select, insert, update on public.menu_print_settings to authenticated;
revoke delete, truncate, references, trigger on public.menu_print_settings from authenticated;
alter table public.menu_print_settings enable row level security;

drop policy if exists menu_print_settings_select on public.menu_print_settings;
create policy menu_print_settings_select on public.menu_print_settings for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())) or public.is_platform_admin(auth.uid()));
drop policy if exists menu_print_settings_insert on public.menu_print_settings;
create policy menu_print_settings_insert on public.menu_print_settings for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]));
drop policy if exists menu_print_settings_update on public.menu_print_settings;
create policy menu_print_settings_update on public.menu_print_settings for update to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]));

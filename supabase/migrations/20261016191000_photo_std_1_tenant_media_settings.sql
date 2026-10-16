-- PHOTO-STD-1 (16-10-2026) — fotostandaard per winkel.
--
-- Eén rij per winkel met de vorm waarin productfoto's moeten staan. De admin past die
-- standaard toe bij uploaden (met preview en "origineel gebruiken") en in bulk.
-- Geen rij = de standaard staat uit (opt-in): voor geen enkele winkel verandert er iets
-- tot iemand hem aanzet.
--
-- Bewust een eigen tabel en NIET tenant_theme_settings: die stroomt via select('*') in
-- storefront-api door naar alle custom frontends (CLAUDE.md §2). Deze tabel leest geen
-- enkele storefront-functie.
--
-- RLS volgens tenant_return_settings: lezen voor iedereen in de winkel, schrijven voor
-- tenant_admin en platform-admin.
--
-- Terugdraaien (handmatig): drop table if exists public.tenant_media_settings;

create table if not exists public.tenant_media_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  -- Verhouding breedte:hoogte, bv. 3 en 4 voor staand 3:4.
  aspect_w smallint not null default 3 check (aspect_w between 1 and 32),
  aspect_h smallint not null default 4 check (aspect_h between 1 and 32),
  -- Breedte van het resultaat in pixels; de hoogte volgt uit de verhouding.
  target_width integer not null default 1200 check (target_width between 400 and 4000),
  -- 'auto' = de randkleur van de foto zelf; anders een hexkleur of 'transparent'.
  background text not null default 'auto'
    check (background = 'auto' or background = 'transparent' or background ~* '^#[0-9a-f]{6}$'),
  -- Vrije ruimte rond het product, in procent van de kortste zijde.
  margin_pct numeric(4,1) not null default 8 check (margin_pct between 0 and 30),
  -- Lege rand rond het product eerst wegknippen (alleen bij een effen achtergrond).
  auto_trim boolean not null default true,
  -- Bij uploaden in een product meteen de preview tonen.
  apply_on_upload boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_media_settings enable row level security;

drop policy if exists tenant_media_settings_select on public.tenant_media_settings;
create policy tenant_media_settings_select on public.tenant_media_settings
  for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));

drop policy if exists tenant_media_settings_insert on public.tenant_media_settings;
create policy tenant_media_settings_insert on public.tenant_media_settings
  for insert to authenticated
  with check (public.is_platform_admin(auth.uid())
    or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin'::app_role])));

drop policy if exists tenant_media_settings_update on public.tenant_media_settings;
create policy tenant_media_settings_update on public.tenant_media_settings
  for update to authenticated
  using (public.is_platform_admin(auth.uid())
    or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin'::app_role])))
  with check (public.is_platform_admin(auth.uid())
    or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin'::app_role])));

drop policy if exists tenant_media_settings_delete on public.tenant_media_settings;
create policy tenant_media_settings_delete on public.tenant_media_settings
  for delete to authenticated
  using (public.is_platform_admin(auth.uid())
    or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin'::app_role])));

revoke all on public.tenant_media_settings from anon;

drop trigger if exists update_tenant_media_settings_updated_at on public.tenant_media_settings;
create trigger update_tenant_media_settings_updated_at
  before update on public.tenant_media_settings
  for each row execute function public.update_updated_at_column();

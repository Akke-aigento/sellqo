-- HORECA-NU-1/2 — dining_areas en tenant_theme_settings zoals live (kolommen en RLS nagetrokken 4-11-2026 via
-- pg_policies), enkel wat 20261104140000_horeca_nu_1.sql en test_horeca_nu.sql nodig hebben.
create table if not exists public.dining_areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  sort integer not null default 0, grid_w integer not null default 40, grid_h integer not null default 24,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.dining_areas enable row level security;
drop policy if exists dining_areas_select on public.dining_areas;
create policy dining_areas_select on public.dining_areas for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists dining_areas_update on public.dining_areas;
create policy dining_areas_update on public.dining_areas for update to authenticated
  using (public.is_platform_admin(auth.uid()) or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[])))
  with check (public.is_platform_admin(auth.uid()) or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[])));
drop policy if exists kassa_device_dining_areas_select on public.dining_areas;
create policy kassa_device_dining_areas_select on public.dining_areas for select to authenticated
  using (tenant_id = (select public.kassa_device_tenant()));
grant select, insert, update on public.dining_areas to authenticated;
grant all on public.dining_areas to service_role;

create table if not exists public.tenant_theme_settings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  shop_live boolean not null default false, shop_ordering boolean not null default false);
alter table public.tenant_theme_settings enable row level security;
grant select on public.tenant_theme_settings to authenticated;

-- Zaak B (22222222-…): Zaal en Terras; zaak A (11111111-…): één ruimte. Online bestellen staat aan bij B.
insert into public.dining_areas (id, tenant_id, name, sort) values
  ('a7000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'Zaal', 0),
  ('a7000000-0000-0000-0000-0000000000b2', '22222222-2222-2222-2222-222222222222', 'Terras', 1),
  ('a7000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Binnen', 0)
on conflict (id) do nothing;
insert into public.tenant_theme_settings (tenant_id, shop_live, shop_ordering)
values ('22222222-2222-2222-2222-222222222222', true, true) on conflict (tenant_id) do nothing;
-- Een gekoppeld kassatoestel voor zaak B (eigen auth-user), zoals KASSA-ACCOUNT-1.
insert into auth.users (id, email) values ('ac000000-0000-0000-0000-0000000000a0', 'nu-toestel@kassa.test') on conflict (id) do nothing;
insert into public.kassa_device_accounts (user_id, tenant_id, terminal_id, device_uuid, name)
values ('ac000000-0000-0000-0000-0000000000a0', '22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0', 'Nu-toestel')
on conflict (user_id) do update set revoked_at = null;

-- DASH-2b — cockpitinstellingen per winkel. Voorlopig enkel het maanddoel (omzet), dat het
-- hele team van de winkel ziet. Nieuwe tabel, raakt geen bestaande tabel of contract.
-- Lezen: iedereen van de winkel (en platformadmins). Schrijven: tenant_admin (has_tenant_role
-- laat platformadmins door).
-- Idempotent. Terugdraaien: drop table public.tenant_cockpit_settings;

create table if not exists public.tenant_cockpit_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  monthly_goal numeric(12, 2) check (monthly_goal is null or monthly_goal > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.tenant_cockpit_settings enable row level security;

drop policy if exists "cockpit settings lezen" on public.tenant_cockpit_settings;
create policy "cockpit settings lezen" on public.tenant_cockpit_settings
  for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));

drop policy if exists "cockpit settings aanmaken" on public.tenant_cockpit_settings;
create policy "cockpit settings aanmaken" on public.tenant_cockpit_settings
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));

drop policy if exists "cockpit settings wijzigen" on public.tenant_cockpit_settings;
create policy "cockpit settings wijzigen" on public.tenant_cockpit_settings
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));

grant select, insert, update on public.tenant_cockpit_settings to authenticated;

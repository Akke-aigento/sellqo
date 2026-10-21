-- DASH-2b review — updated_by van tenant_cockpit_settings is niet vrij in te vullen: standaard
-- de ingelogde gebruiker, en insert/update weigeren een andere uuid. Idempotent.
-- Terugdraaien: de twee policies opnieuw aanmaken zoals in 20261021100000 en
-- alter table public.tenant_cockpit_settings alter column updated_by drop default;

alter table public.tenant_cockpit_settings alter column updated_by set default auth.uid();

drop policy if exists "cockpit settings aanmaken" on public.tenant_cockpit_settings;
create policy "cockpit settings aanmaken" on public.tenant_cockpit_settings
  for insert to authenticated
  with check (
    public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[])
    and (updated_by is null or updated_by = auth.uid())
  );

drop policy if exists "cockpit settings wijzigen" on public.tenant_cockpit_settings;
create policy "cockpit settings wijzigen" on public.tenant_cockpit_settings
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]))
  with check (
    public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[])
    and (updated_by is null or updated_by = auth.uid())
  );

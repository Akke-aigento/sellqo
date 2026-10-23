-- Extra stub: app_role-enum + has_tenant_role zoals live (23-10-2026 nagetrokken).
create type public.app_role as enum ('platform_admin','tenant_admin','staff','accountant','viewer','warehouse','marketing');
alter table public.user_roles alter column role type public.app_role using role::public.app_role;
create or replace function public.has_tenant_role(_tenant_id uuid, _allowed_roles public.app_role[]) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and (ur.tenant_id = _tenant_id or ur.role = 'platform_admin'::public.app_role) and ur.role = any(_allowed_roles))
      or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'platform_admin'::public.app_role);
$$;
grant execute on function public.has_tenant_role(uuid, public.app_role[]) to authenticated;

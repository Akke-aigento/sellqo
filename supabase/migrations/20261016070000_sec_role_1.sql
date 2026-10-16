-- SEC-ROLE-1 — 16 oktober 2026 — KRITIEK
-- Nachtelijke RLS-escalatie-audit (rollbacktests): elke tenant_admin kon zijn eigen
-- user_roles-rij op 'platform_admin' zetten (policy "Tenant admins can update roles in
-- their tenant" beperkt de rolkolom niet). Omdat elke ingelogde gebruiker een eigen winkel
-- mag aanmaken en daar tenant_admin wordt, was de ketting: registreren → winkel →
-- platform_admin → alle tenants. Daarnaast: een team_invitations-rij met rol
-- platform_admin werd door accept-team-invitation (service_role) toegekend, en een
-- tenant_admin kon user_id/tenant_id van rollen omhangen.
-- Geen sporen van misbruik: 1 platform_admin-rij (Akke), 0 uitnodigingen met platform_admin.
--
-- Fix:
--  * trigger user_roles_guard (SECURITY INVOKER, zodat current_user de echte rol is):
--    - postgres/supabase_admin (migraties, SECURITY DEFINER-triggers zoals
--      assign_tenant_admin_role_on_tenant_insert): ongemoeid;
--    - platform-admin: ongemoeid;
--    - anders (authenticated, anon, service_role): nooit platform_admin toekennen;
--      een ingelogde gebruiker mag user_id/tenant_id van een rol niet wijzigen.
--  * CHECK op team_invitations: role <> 'platform_admin'.
--
-- Legitieme schrijvers blijven werken: useTeamMembers.updateMemberRole (alleen role),
-- accept-team-invitation, create-tenant, repair-tenant-access (gewone rollen, service_role).
-- Een nieuwe platform-admin toevoegen kan nog via de SQL-console (postgres).
--
-- Idempotent. Terugdraaien:
--   drop trigger if exists user_roles_guard on public.user_roles;
--   drop function if exists public.user_roles_guard();
--   alter table public.team_invitations drop constraint if exists team_invitations_no_platform_admin;

create or replace function public.user_roles_guard()
 returns trigger
 language plpgsql
 security invoker
 set search_path to 'public', 'pg_temp'
as $f$
begin
  if current_user not in ('authenticated', 'anon', 'service_role') then
    return new;
  end if;
  if auth.uid() is not null and public.is_platform_admin(auth.uid()) then
    return new;
  end if;
  if new.role = 'platform_admin'::app_role then
    raise exception 'De rol platform_admin kan alleen SellQo toekennen' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null
     and (new.user_id is distinct from old.user_id or new.tenant_id is distinct from old.tenant_id) then
    raise exception 'Gebruiker of winkel van een rol wijzigen mag niet' using errcode = '42501';
  end if;
  return new;
end
$f$;

drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard
  before insert or update on public.user_roles
  for each row execute function public.user_roles_guard();

alter table public.team_invitations drop constraint if exists team_invitations_no_platform_admin;
alter table public.team_invitations add constraint team_invitations_no_platform_admin
  check (role <> 'platform_admin'::app_role);

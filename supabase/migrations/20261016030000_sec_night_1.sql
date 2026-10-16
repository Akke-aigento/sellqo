-- SEC-NIGHT-1 — 16 oktober 2026
-- Uit de nachtelijke gezondheidscheck (RLS-scan): twee SECURITY DEFINER-functies
-- zonder autorisatie, uitvoerbaar door anon en door elke ingelogde gebruiker.
--   * resolve_sync_conflict: wie een conflict-ID kent, sloot conflicten van ELKE
--     tenant af (ook marketplace-/bol-conflicten).
--   * log_admin_action: elke ingelogde gebruiker kon regels in admin_actions_log
--     schrijven voor eender welke tenant.
--
-- Fix: EXECUTE weg bij anon/public; bij een ingelogde gebruiker moet het om een
-- eigen tenant gaan (of platform-admin). Service-role-aanroepen (auth.uid() null)
-- gedragen zich exact als voorheen. Aanroepers (useSyncConflicts, usePlatformAdmin,
-- usePlatformPromotions, remove-team-member) blijven werken: ze handelen altijd over
-- de eigen tenant of zijn platform-admin.
--
-- Idempotent. Terugdraaien: de vorige definities staan in ops.sec_night_1_prev_functions;
-- daarna `grant execute on function ... to anon;` voor beide.

create schema if not exists ops;
create table if not exists ops.sec_night_1_prev_functions (
  proname text primary key,
  definition text not null,
  saved_at timestamptz not null default now()
);
insert into ops.sec_night_1_prev_functions (proname, definition)
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('resolve_sync_conflict', 'log_admin_action')
on conflict (proname) do nothing;

create or replace function public.resolve_sync_conflict(p_conflict_id uuid, p_resolution text, p_resolution_data jsonb default null::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is not null then
    select tenant_id into v_tenant from public.sync_conflicts where id = p_conflict_id;
    if v_tenant is null then
      return; -- onbekend conflict: zelfde effect als voorheen (UPDATE raakte 0 rijen)
    end if;
    if not (public.is_platform_admin(auth.uid())
            or v_tenant in (select public.get_user_tenant_ids(auth.uid()))) then
      raise exception 'Geen toegang tot dit conflict' using errcode = '42501';
    end if;
  end if;

  update sync_conflicts
  set
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution = p_resolution,
    resolution_data = p_resolution_data
  where id = p_conflict_id;
end;
$function$;

create or replace function public.log_admin_action(p_target_tenant_id uuid, p_action_type text, p_action_details jsonb default '{}'::jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_action_id uuid;
begin
  if auth.uid() is not null
     and not public.is_platform_admin(auth.uid())
     and (p_target_tenant_id is null
          or p_target_tenant_id not in (select public.get_user_tenant_ids(auth.uid()))) then
    raise exception 'Geen toegang tot deze tenant' using errcode = '42501';
  end if;

  insert into admin_actions_log (admin_user_id, target_tenant_id, action_type, action_details)
  values (auth.uid(), p_target_tenant_id, p_action_type, p_action_details)
  returning id into v_action_id;

  return v_action_id;
end;
$function$;

revoke execute on function public.resolve_sync_conflict(uuid, text, jsonb) from public, anon;
revoke execute on function public.log_admin_action(uuid, text, jsonb) from public, anon;
grant execute on function public.resolve_sync_conflict(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.log_admin_action(uuid, text, jsonb) to authenticated, service_role;

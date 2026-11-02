-- KASSA-MOBIEL-1 — device_tokens, horeca_notify_devices en de twee meldingsfuncties zoals live (nagetrokken
-- 2-11-2026, vóór de patch). Na de KASSA-ACCOUNT-1-test (die een minimale device_tokens neerzet).
alter table public.device_tokens
  add column if not exists platform text not null default 'web',
  add column if not exists device_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists p256dh text,
  add column if not exists auth text,
  add column if not exists os text,
  add column if not exists install_id text;
delete from public.device_tokens;
alter table public.device_tokens alter column token set not null;
alter table public.device_tokens alter column platform drop default;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'device_tokens_token_key') then
    alter table public.device_tokens add constraint device_tokens_token_key unique (token);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'device_tokens_platform_check') then
    alter table public.device_tokens add constraint device_tokens_platform_check check (platform = any (array['ios', 'android', 'web']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'device_tokens_web_keys_check') then
    alter table public.device_tokens add constraint device_tokens_web_keys_check check (platform <> 'web' or (p256dh is not null and auth is not null));
  end if;
end $$;
-- Live policies (vier aparte, auth.uid() = user_id).
drop policy if exists dt_own on public.device_tokens;
drop policy if exists "Users can delete their own device tokens" on public.device_tokens;
drop policy if exists "Users can insert their own device tokens" on public.device_tokens;
drop policy if exists "Users can update their own device tokens" on public.device_tokens;
drop policy if exists "Users can view their own device tokens" on public.device_tokens;
create policy "Users can delete their own device tokens" on public.device_tokens for delete to authenticated using (auth.uid() = user_id);
create policy "Users can insert their own device tokens" on public.device_tokens for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own device tokens" on public.device_tokens for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can view their own device tokens" on public.device_tokens for select to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.device_tokens to authenticated;

create table if not exists public.horeca_notify_devices (
  tenant_id uuid not null, install_id text not null, name text not null default '', kind text not null default 'other',
  events text[] not null default '{}', station_ids uuid[] not null default '{}', personal boolean not null default false,
  lang text not null default 'nl', created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (tenant_id, install_id));

-- Live definities van vóór KASSA-MOBIEL-1 (enkel als ze nog niet gepatcht zijn: run.sh draait dit één keer).
create or replace function public.horeca_notify_targets(p_tenant_id uuid, p_event text, p_station_id uuid)
returns table (install_id text, lang text, kind text, token text, platform text, p256dh text, auth text)
language sql stable security definer set search_path to ''
as $function$
  select d.install_id, d.lang, d.kind, k.token, k.platform, k.p256dh, k.auth
    from public.horeca_notify_devices d
    join public.device_tokens k on k.install_id = d.install_id
   where d.tenant_id = p_tenant_id
     and p_event = any(d.events)
     and (p_event <> 'ticket_new' or d.station_ids = '{}' or p_station_id = any(d.station_ids))
     -- Een toestel van iemand die uit het team gehaald is, krijgt niets meer.
     and exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = p_tenant_id);
$function$;

create or replace function public.horeca_notify_devices_list(p_tenant_id uuid)
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not /* KASSA-ACCOUNT-1 */ public.kassa_can_operate(p_tenant_id) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'install_id', d.install_id, 'name', d.name, 'kind', d.kind, 'events', d.events, 'station_ids', d.station_ids,
      'personal', d.personal, 'lang', d.lang, 'updated_at', d.updated_at,
      'push', coalesce(t.n, 0) > 0, 'os', t.os, 'platforms', t.platforms, 'last_seen_at', t.last_seen_at)
      order by d.kind, d.name)
    from public.horeca_notify_devices d
    left join lateral (
      select count(*) as n, max(k.os) as os, jsonb_agg(distinct k.platform) as platforms, max(k.last_seen_at) as last_seen_at
        from public.device_tokens k
       where k.install_id = d.install_id
         and exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = d.tenant_id)
    ) t on true
    where d.tenant_id = p_tenant_id and not (d.events = '{}' and not d.personal and d.kind in ('kassa', 'station'))), '[]'::jsonb);
end;
$function$;

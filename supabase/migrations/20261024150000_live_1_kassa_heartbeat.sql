-- LIVE-1 — toestelhartslag van SellQo Kassa (ontwerp §6.7).
--
-- Elk kassatoestel meldt zich elke minuut: versie, wachtende acties (wachtrij, ondertekende
-- events en betalingen die nog naar de cloud moeten) en wanneer het laatst gesynchroniseerd
-- heeft. Zo zien de uitbater (Kassa › Kassa's) en SellQo (Watchtower) een toestel dat
-- stilvalt of achterloopt, vóór de klant belt.
--
-- Handmatig terugdraaien (niet live gedraaid; geen data):
--   drop function if exists public.kassa_heartbeat(uuid, uuid, text, jsonb);
--   drop table if exists public.kassa_devices;

create table if not exists public.kassa_devices (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 200),
  terminal_id uuid not null,                          -- pos_terminals.id
  sw_version text check (sw_version is null or char_length(sw_version) <= 36),
  fiscal_mode text check (fiscal_mode is null or fiscal_mode in ('off', 'simulator', 'fdm')),
  queue_count integer not null default 0 check (queue_count between 0 and 100000),
  outbox_count integer not null default 0 check (outbox_count between 0 and 100000),
  pending_pays integer not null default 0 check (pending_pays between 0 and 100000),
  last_sync_at timestamptz,
  online boolean not null default true,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (tenant_id, device_id)
);
create index if not exists kassa_devices_terminal on public.kassa_devices (terminal_id);

revoke all on public.kassa_devices from public, anon, authenticated;
grant all on public.kassa_devices to service_role;
grant select on public.kassa_devices to authenticated;
alter table public.kassa_devices enable row level security;
drop policy if exists kassa_devices_select on public.kassa_devices;
create policy kassa_devices_select on public.kassa_devices for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- p_info = {sw_version, fiscal_mode, queue_count, outbox_count, pending_pays, last_sync_at, online, user_agent}
create or replace function public.kassa_heartbeat(p_tenant_id uuid, p_terminal_id uuid, p_device_id text, p_info jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pos_terminals t where t.id = p_terminal_id and t.tenant_id = p_tenant_id) then
    raise exception 'onbekende kassa' using errcode = '22023';
  end if;
  insert into public.kassa_devices as d (tenant_id, device_id, terminal_id, sw_version, fiscal_mode, queue_count, outbox_count, pending_pays,
    last_sync_at, online, user_agent, last_seen_at)
  values (p_tenant_id, left(p_device_id, 200), p_terminal_id, left(p_info ->> 'sw_version', 36),
    case when p_info ->> 'fiscal_mode' in ('off', 'simulator', 'fdm') then p_info ->> 'fiscal_mode' end,
    least(greatest(coalesce((p_info ->> 'queue_count')::integer, 0), 0), 100000),
    least(greatest(coalesce((p_info ->> 'outbox_count')::integer, 0), 0), 100000),
    least(greatest(coalesce((p_info ->> 'pending_pays')::integer, 0), 0), 100000),
    nullif(p_info ->> 'last_sync_at', '')::timestamptz, coalesce((p_info ->> 'online')::boolean, true),
    left(p_info ->> 'user_agent', 300), now())
  on conflict (tenant_id, device_id) do update set
    terminal_id = excluded.terminal_id, sw_version = excluded.sw_version, fiscal_mode = excluded.fiscal_mode,
    queue_count = excluded.queue_count, outbox_count = excluded.outbox_count, pending_pays = excluded.pending_pays,
    last_sync_at = excluded.last_sync_at, online = excluded.online, user_agent = excluded.user_agent, last_seen_at = now();
  update public.pos_terminals set last_seen_at = now() where id = p_terminal_id;
end;
$$;
revoke all on function public.kassa_heartbeat(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_heartbeat(uuid, uuid, text, jsonb) to authenticated;

-- KASSA-RECHTEN-1 — korting, "van het huis" en het annuleren van verstuurde lijnen enkel met
-- het akkoord van een eigenaar of verantwoordelijke.
--
-- Tot nu toe controleerde horeca_apply_one enkel has_tenant_role (tenant_admin/staff): elke
-- kassamedewerker kon −50 %, gratis of een verstuurde lijn annuleren. Nu:
--   - is de medewerker van het commando (staff_id) zelf owner/manager → zoals voorheen;
--   - anders moet het commando een approval_id dragen: een eenmalig akkoord (5 minuten geldig,
--     gebonden aan actie + rekening + lijn) dat kassa_approve uitreikt na de PIN van een
--     owner/manager. Zelfde PIN-controle en lockout als kassa_product_quick_edit (KASSA-0.6):
--     5 foute pogingen = 5 minuten slot, elke foute PIN en elk akkoord in fiscal_audit_log.
--   Waarom een apart akkoord en niet de PIN in het commando: een foute PIN binnen horeca_apply
--   rolt mee terug (subtransactie per commando), dan telt de lockout niet en is de PIN via
--   50 commando's per aanroep te raden. En zo komt er nooit een PIN in de wachtrij op het toestel.
--
-- Fiscaal: niets verandert aan de events (P/ORDER, correcties, PRICE_CHANGE blijven identiek);
-- dit is enkel een extra voorwaarde vóór de bestaande takken. Ontwerp-lijnen weghalen blijft vrij.
--
-- Aanpak: horeca_apply_one wordt uitgebreid via pg_get_functiondef + replace (één anker, precies
-- één keer), zoals KASSA-UX-4 (cancel_bill), zodat andere patches op de live functie behouden blijven.
-- Idempotent: bevat de functie al 'KASSA-RECHTEN-1', dan gebeurt er niets.
--
-- Handmatig terugdraaien:
--   execute de def uit snapshots.sellqo_20261101_fn_kassa_rechten_1 (name = 'horeca_apply_one');
--   drop function if exists public.kassa_require_approval(uuid, uuid, jsonb), public.kassa_approve(uuid, text, jsonb);
--   drop table if exists public.kassa_approvals;

-- 0. Snapshot vóór de patch -------------------------------------------------------------------
create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261101_fn_kassa_rechten_1 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as md5, now() as taken_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'horeca_apply_one';
revoke all on snapshots.sellqo_20261101_fn_kassa_rechten_1 from anon, authenticated;

-- 1. Eenmalige akkoorden ------------------------------------------------------------------------
create table if not exists public.kassa_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action text not null check (action in ('discount', 'void_sent')),
  check_id uuid not null,
  line_id uuid,
  approver_id uuid not null references public.pos_cashiers(id) on delete cascade,
  staff_id uuid references public.pos_cashiers(id) on delete set null,
  device_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  command_id uuid
);
comment on table public.kassa_approvals is 'KASSA-RECHTEN-1: eenmalig akkoord van een eigenaar/verantwoordelijke (PIN) voor korting of annuleren van een verstuurde lijn.';
create index if not exists kassa_approvals_tenant on public.kassa_approvals (tenant_id, created_at desc);
alter table public.kassa_approvals enable row level security;
-- Geen policies: enkel de security-definer-functies hieronder lezen en schrijven.
revoke all on public.kassa_approvals from anon, authenticated;

-- 2. Akkoord uitreiken na de PIN van een owner/manager ------------------------------------------
-- p = {staff_id, approver_id, pin, action: discount|void_sent, check_id, line_id}
-- Antwoord: {ok: true, approval_id, approver_name} of {ok: false, reason: wrong_pin|locked}.
create or replace function public.kassa_approve(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  c public.pos_cashiers%rowtype;
  v_by uuid;
  v_id uuid;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p, 'null'::jsonb)) <> 'object' then
    raise exception 'geen akkoord gevraagd' using errcode = '22023';
  end if;
  if coalesce(p ->> 'approver_id', '') !~ '^[0-9a-f-]{36}$' or coalesce(p ->> 'check_id', '') !~ '^[0-9a-f-]{36}$'
     or coalesce(p ->> 'action', '') not in ('discount', 'void_sent')
     or (nullif(p ->> 'line_id', '') is not null and (p ->> 'line_id') !~ '^[0-9a-f-]{36}$') then
    raise exception 'goedkeurder, actie en rekening zijn verplicht' using errcode = '22023';
  end if;
  if not exists (select 1 from public.dining_checks d where d.id = (p ->> 'check_id')::uuid and d.tenant_id = p_tenant_id) then
    raise exception 'rekening niet gevonden' using errcode = 'P0002';
  end if;
  if coalesce(p ->> 'staff_id', '') ~ '^[0-9a-f-]{36}$' then
    select x.id into v_by from public.pos_cashiers x where x.id = (p ->> 'staff_id')::uuid and x.tenant_id = p_tenant_id;
  end if;
  select * into c from public.pos_cashiers x where x.id = (p ->> 'approver_id')::uuid and x.tenant_id = p_tenant_id for update;
  if c.id is null or not c.is_active or not coalesce(c.can_use_pos, true) then raise exception 'onbekende medewerker' using errcode = '22023'; end if;
  if c.role not in ('owner', 'manager') then
    raise exception 'enkel een eigenaar of verantwoordelijke' using errcode = '42501';
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  if coalesce(p ->> 'pin', '') = '' or c.pin_hash is null or c.pin_hash <> crypt(p ->> 'pin', c.pin_hash) then
    -- Zelfde lockout als kassa_staff_login / kassa_product_quick_edit. Geen exception: anders rolt de teller terug.
    update public.pos_cashiers set
      failed_pin_attempts = case when c.failed_pin_attempts + 1 >= 5 then 0 else c.failed_pin_attempts + 1 end,
      locked_until = case when c.failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
    where id = c.id;
    insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
      values (p_tenant_id, auth.uid(), left(coalesce(p_device_id, ''), 120), 'pin_failed',
        jsonb_build_object('staff_id', c.id, 'attempt', c.failed_pin_attempts + 1, 'context', 'kassa_approval'));
    return jsonb_build_object('ok', false, 'reason', case when c.failed_pin_attempts + 1 >= 5 then 'locked' else 'wrong_pin' end);
  end if;
  update public.pos_cashiers set failed_pin_attempts = 0, locked_until = null where id = c.id and (failed_pin_attempts <> 0 or locked_until is not null);
  insert into public.kassa_approvals (tenant_id, action, check_id, line_id, approver_id, staff_id, device_id, expires_at)
    values (p_tenant_id, p ->> 'action', (p ->> 'check_id')::uuid, nullif(p ->> 'line_id', '')::uuid, c.id, v_by,
            left(coalesce(p_device_id, ''), 120), now() + interval '5 minutes')
    returning id into v_id;
  insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
    values (p_tenant_id, auth.uid(), left(coalesce(p_device_id, ''), 120), 'kassa_approval',
      jsonb_build_object('approval_id', v_id, 'action', p ->> 'action', 'check_id', p ->> 'check_id', 'line_id', nullif(p ->> 'line_id', ''),
                         'approver_id', c.id, 'staff_id', coalesce(v_by, c.id)));
  return jsonb_build_object('ok', true, 'approval_id', v_id, 'approver_name', c.display_name);
end;
$$;
revoke all on function public.kassa_approve(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_approve(uuid, text, jsonb) to authenticated;

-- 3. Controle in horeca_apply_one (niet rechtstreeks uitvoerbaar) -------------------------------
create or replace function public.kassa_require_approval(p_tenant_id uuid, p_check_id uuid, cmd jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_staff uuid := nullif(cmd ->> 'staff_id', '')::uuid;
  v_action text := case cmd ->> 'kind' when 'discount_line' then 'discount' else 'void_sent' end;
  v_line uuid := nullif(cmd ->> 'line_id', '')::uuid;
  a public.kassa_approvals%rowtype;
begin
  -- Eigenaar of verantwoordelijke aan de kassa: meteen.
  if v_staff is not null and exists (select 1 from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id
                                       and s.is_active and s.role in ('owner', 'manager')) then
    return;
  end if;
  if coalesce(cmd ->> 'approval_id', '') !~ '^[0-9a-f-]{36}$' then
    raise exception 'akkoord van een eigenaar of verantwoordelijke nodig' using errcode = '42501';
  end if;
  select * into a from public.kassa_approvals x where x.id = (cmd ->> 'approval_id')::uuid and x.tenant_id = p_tenant_id for update;
  if a.id is null or a.used_at is not null or a.expires_at < now() or a.action <> v_action
     or a.check_id <> p_check_id or a.line_id is distinct from v_line then
    raise exception 'akkoord ongeldig of verlopen: vraag het opnieuw' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pos_cashiers s where s.id = a.approver_id and s.tenant_id = p_tenant_id
                   and s.is_active and s.role in ('owner', 'manager')) then
    raise exception 'de goedkeurder is geen eigenaar of verantwoordelijke meer' using errcode = '42501';
  end if;
  -- Eenmalig. Wordt het commando verderop geweigerd, dan rolt dit mee terug (subtransactie) en
  -- blijft het akkoord bruikbaar voor dezelfde lijn tot het verloopt.
  update public.kassa_approvals set used_at = now(), command_id = nullif(cmd ->> 'id', '')::uuid where id = a.id;
end;
$$;
revoke all on function public.kassa_require_approval(uuid, uuid, jsonb) from public, anon, authenticated;

-- 4. horeca_apply_one: de controle vóór de commando-takken --------------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure);
  anchor text := E'  if v_kind = ''add_line'' then\n';
  gate text := E'  -- KASSA-RECHTEN-1: korting/van het huis en annuleren van een verstuurde lijn enkel met akkoord\n'
            || E'  -- van een eigenaar of verantwoordelijke (zelf aan de kassa, of via kassa_approve).\n'
            || E'  if v_kind = ''discount_line'' or (v_kind = ''void_line'' and exists (select 1 from public.check_lines x\n'
            || E'       where x.id = nullif(cmd ->> ''line_id'', '''')::uuid and x.check_id = c.id and x.state = ''sent'')) then\n'
            || E'    perform public.kassa_require_approval(p_tenant_id, c.id, cmd);\n'
            || E'  end if;\n\n';
begin
  if position('KASSA-RECHTEN-1' in d) > 0 then
    raise notice 'KASSA-RECHTEN-1: horeca_apply_one al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KASSA-RECHTEN-1: anker add_line niet precies één keer gevonden in horeca_apply_one';
  end if;
  execute replace(d, anchor, gate || anchor);
end
$patch$;

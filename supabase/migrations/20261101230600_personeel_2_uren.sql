-- PERSONEEL-2 — in/uitklokken server-side, urenoverzicht en correcties.
--
-- Waarom: PERSONEEL-1 bewaarde "ingeklokt" enkel in localStorage van het toestel. Inklokken op
-- tablet A, tablet B wist het niet, en er was geen urenoverzicht. Nu:
--   kassa_shifts             = één rij per gewerkte shift (in → uit), geschreven door de kassa via
--                              kassa_clock. Bron van waarheid voor de knopstand (kassa_clock_state).
--   kassa_shift_corrections  = correcties door de zaakvoerder (tenant_admin), APPEND-ONLY. Een
--                              correctie wijzigt de shift niet; de laatste correctie per shift wint
--                              (adjust = andere tijden, void = telt niet, add = vergeten shift).
--
-- Fiscaal (GKS): in fiscale modus blijft in/uitklokken een ondertekend S-event (WORK_IN/WORK_OUT)
-- in fiscal_events, ongewijzigd. kassa_clock komt NA het tekenen en bewaart enkel het event-id
-- als verwijzing (gecontroleerd). fiscal_events en fiscal_audit_log worden hier niet aangeraakt.
--
-- Een shift wordt nooit gewist. De enige toegelaten wijziging op kassa_shifts is het afsluiten
-- van een open shift (clock_out_at van leeg naar een tijd), via kassa_clock.
--
-- Additief: twee nieuwe tabellen en vier functies; niets bestaands geraakt. Idempotent.
-- Handmatig terugdraaien (enkel zolang er geen echte uren in staan):
--   drop function if exists public.kassa_clock(uuid, uuid, text, text, uuid, uuid), public.kassa_clock_state(uuid, uuid),
--     public.kassa_shift_correct(uuid, jsonb), public.kassa_hours_report(uuid, timestamptz, timestamptz),
--     public.kassa_shifts_effective(uuid, timestamptz, timestamptz);
--   drop table if exists public.kassa_shift_corrections; drop table if exists public.kassa_shifts;
--   drop function if exists public.kassa_shifts_guard(), public.kassa_shift_corrections_guard();

-- ── Shifts ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.kassa_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  staff_id uuid not null references public.pos_cashiers(id) on delete restrict,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  in_device_id text check (in_device_id is null or char_length(in_device_id) <= 200),
  out_device_id text check (out_device_id is null or char_length(out_device_id) <= 200),
  in_terminal_id uuid,                                  -- pos_terminals.id
  out_terminal_id uuid,
  in_fiscal_event_id uuid,                              -- fiscal_events.id (signWorkIn), enkel in fiscale modus
  out_fiscal_event_id uuid,                             -- fiscal_events.id (signWorkOut)
  created_by uuid default auth.uid(),
  closed_by uuid,
  created_at timestamptz not null default now(),
  constraint kassa_shifts_order check (clock_out_at is null or clock_out_at >= clock_in_at)
);
create index if not exists kassa_shifts_tenant_in on public.kassa_shifts (tenant_id, clock_in_at desc);
create index if not exists kassa_shifts_open on public.kassa_shifts (tenant_id, staff_id) where clock_out_at is null;

-- Enkel afsluiten mag: clock_out_at (en de out_*-velden) van leeg naar ingevuld, de rest identiek.
create or replace function public.kassa_shifts_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE' and old.clock_out_at is null and new.clock_out_at is not null
     and new.id = old.id and new.tenant_id = old.tenant_id and new.staff_id = old.staff_id
     and new.clock_in_at = old.clock_in_at and new.in_device_id is not distinct from old.in_device_id
     and new.in_terminal_id is not distinct from old.in_terminal_id and new.in_fiscal_event_id is not distinct from old.in_fiscal_event_id
     and new.created_by is not distinct from old.created_by and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'kassa_shifts: enkel een open shift afsluiten is toegelaten (% geweigerd)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists kassa_shifts_guard on public.kassa_shifts;
create trigger kassa_shifts_guard before update or delete on public.kassa_shifts
  for each row execute function public.kassa_shifts_guard();
drop trigger if exists kassa_shifts_no_truncate on public.kassa_shifts;
create trigger kassa_shifts_no_truncate before truncate on public.kassa_shifts
  for each statement execute function public.kassa_shifts_guard();

-- ── Correcties (append-only) ──────────────────────────────────────────────────────────────
create table if not exists public.kassa_shift_corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  shift_id uuid references public.kassa_shifts(id) on delete restrict,   -- leeg bij 'add'
  staff_id uuid not null references public.pos_cashiers(id) on delete restrict,
  action text not null check (action in ('adjust', 'void', 'add')),
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  reason text not null check (char_length(btrim(reason)) between 3 and 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint kassa_shift_corrections_shape check (
    (action = 'add' and shift_id is null and clock_in_at is not null and clock_out_at is not null)
    or (action = 'adjust' and shift_id is not null and clock_in_at is not null and clock_out_at is not null)
    or (action = 'void' and shift_id is not null and clock_in_at is null and clock_out_at is null)
  ),
  constraint kassa_shift_corrections_order check (clock_out_at is null or clock_in_at is null or clock_out_at > clock_in_at),
  constraint kassa_shift_corrections_len check (clock_out_at is null or clock_in_at is null or clock_out_at - clock_in_at <= interval '24 hours')
);
create index if not exists kassa_shift_corrections_shift on public.kassa_shift_corrections (shift_id, created_at desc);
create index if not exists kassa_shift_corrections_tenant on public.kassa_shift_corrections (tenant_id, created_at desc);

create or replace function public.kassa_shift_corrections_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'kassa_shift_corrections: append-only (% geweigerd)', tg_op using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists kassa_shift_corrections_guard on public.kassa_shift_corrections;
create trigger kassa_shift_corrections_guard before update or delete on public.kassa_shift_corrections
  for each row execute function public.kassa_shift_corrections_guard();
drop trigger if exists kassa_shift_corrections_no_truncate on public.kassa_shift_corrections;
create trigger kassa_shift_corrections_no_truncate before truncate on public.kassa_shift_corrections
  for each statement execute function public.kassa_shift_corrections_guard();

-- Rechten: schrijven enkel via de functies; lezen enkel de zaakvoerder (uren = loongegevens).
revoke all on public.kassa_shifts, public.kassa_shift_corrections from public, anon, authenticated;
grant all on public.kassa_shifts, public.kassa_shift_corrections to service_role;
grant select on public.kassa_shifts, public.kassa_shift_corrections to authenticated;
alter table public.kassa_shifts enable row level security;
alter table public.kassa_shift_corrections enable row level security;
drop policy if exists kassa_shifts_select on public.kassa_shifts;
create policy kassa_shifts_select on public.kassa_shifts for select to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
drop policy if exists kassa_shift_corrections_select on public.kassa_shift_corrections;
create policy kassa_shift_corrections_select on public.kassa_shift_corrections for select to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));

-- ── Effectieve shifts (shift + laatste correctie, plus toegevoegde) ─────────────────────────
-- Intern (geen grant): de rolcontrole zit in de functies die dit aanroepen.
-- Een shift telt mee als zijn effectieve begin in [p_from, p_to) valt, of als hij nog open is.
create or replace function public.kassa_shifts_effective(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, staff_id uuid, source text, clock_in_at timestamptz, clock_out_at timestamptz,
  original_in timestamptz, original_out timestamptz, voided boolean, corrected boolean, reason text, corrected_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $$
  with last_corr as (
    select distinct on (c.shift_id) c.* from public.kassa_shift_corrections c
    where c.tenant_id = p_tenant_id and c.shift_id is not null
    order by c.shift_id, c.created_at desc, c.id desc
  ), eff as (
    select s.id, s.staff_id, 'kassa'::text as source,
           case when lc.action = 'adjust' then lc.clock_in_at else s.clock_in_at end as clock_in_at,
           case when lc.action = 'adjust' then lc.clock_out_at else s.clock_out_at end as clock_out_at,
           s.clock_in_at as original_in, s.clock_out_at as original_out,
           coalesce(lc.action = 'void', false) as voided, lc.id is not null as corrected, lc.reason, lc.created_at as corrected_at
    from public.kassa_shifts s left join last_corr lc on lc.shift_id = s.id
    where s.tenant_id = p_tenant_id
    union all
    select c.id, c.staff_id, 'manual', c.clock_in_at, c.clock_out_at, null, null, false, true, c.reason, c.created_at
    from public.kassa_shift_corrections c where c.tenant_id = p_tenant_id and c.action = 'add'
  )
  select * from eff e
  where (e.clock_in_at >= p_from and e.clock_in_at < p_to) or (e.clock_out_at is null and not e.voided);
$$;
revoke all on function public.kassa_shifts_effective(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Open shift van een medewerker volgens de bron + correcties (een gecorrigeerde of geschrapte
-- shift is niet meer open, ook al staat clock_out_at in de bron nog leeg).
create or replace function public.kassa_open_shift(p_tenant_id uuid, p_staff_id uuid)
returns public.kassa_shifts
language sql
stable
security definer
set search_path to ''
as $$
  select s.* from public.kassa_shifts s
  where s.tenant_id = p_tenant_id and s.staff_id = p_staff_id and s.clock_out_at is null
    and not exists (select 1 from public.kassa_shift_corrections c where c.shift_id = s.id)
  order by s.clock_in_at desc limit 1;
$$;
revoke all on function public.kassa_open_shift(uuid, uuid) from public, anon, authenticated;

-- ── Kassa: knopstand en klokken ───────────────────────────────────────────────────────────
-- Antwoord: {state: 'in'|'out', shift_id, since}
create or replace function public.kassa_clock_state(p_tenant_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  s public.kassa_shifts;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  s := public.kassa_open_shift(p_tenant_id, p_staff_id);
  if s.id is null then return jsonb_build_object('state', 'out'); end if;
  return jsonb_build_object('state', 'in', 'shift_id', s.id, 'since', s.clock_in_at);
end;
$$;
revoke all on function public.kassa_clock_state(uuid, uuid) from public, anon;
grant execute on function public.kassa_clock_state(uuid, uuid) to authenticated;

-- Inklokken = open shift (of de bestaande teruggeven); uitklokken = de open shift afsluiten.
-- p_fiscal_event_id (fiscale modus): het ondertekende signWorkIn/Out-event van deze medewerker.
-- Antwoord: {state, shift_id, since, changed} — changed = false als de stand al zo was.
create or replace function public.kassa_clock(p_tenant_id uuid, p_staff_id uuid, p_direction text, p_device_id text,
                                              p_terminal_id uuid, p_fiscal_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  s public.kassa_shifts;
  v_id uuid;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_direction not in ('in', 'out') then raise exception 'richting in of out' using errcode = '22023'; end if;
  if not exists (select 1 from public.pos_cashiers c where c.id = p_staff_id and c.tenant_id = p_tenant_id and c.is_active) then
    raise exception 'medewerker niet gevonden' using errcode = 'P0002';
  end if;
  if p_fiscal_event_id is not null and not exists (
       select 1 from public.fiscal_events f where f.id = p_fiscal_event_id and f.tenant_id = p_tenant_id
         and f.staff_id = p_staff_id and f.mutation = case when p_direction = 'in' then 'signWorkIn' else 'signWorkOut' end) then
    raise exception 'fiscaal event hoort niet bij deze klokactie' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('kassa_clock|' || p_staff_id::text));
  s := public.kassa_open_shift(p_tenant_id, p_staff_id);
  if p_direction = 'in' then
    if s.id is not null then
      return jsonb_build_object('state', 'in', 'shift_id', s.id, 'since', s.clock_in_at, 'changed', false);
    end if;
    insert into public.kassa_shifts (tenant_id, staff_id, in_device_id, in_terminal_id, in_fiscal_event_id)
      values (p_tenant_id, p_staff_id, left(p_device_id, 200), p_terminal_id, p_fiscal_event_id)
      returning * into s;
    return jsonb_build_object('state', 'in', 'shift_id', s.id, 'since', s.clock_in_at, 'changed', true);
  end if;
  if s.id is null then
    return jsonb_build_object('state', 'out', 'changed', false);
  end if;
  update public.kassa_shifts set clock_out_at = greatest(now(), s.clock_in_at), out_device_id = left(p_device_id, 200),
         out_terminal_id = p_terminal_id, out_fiscal_event_id = p_fiscal_event_id, closed_by = auth.uid()
    where id = s.id returning id into v_id;
  return jsonb_build_object('state', 'out', 'shift_id', v_id, 'changed', true);
end;
$$;
revoke all on function public.kassa_clock(uuid, uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.kassa_clock(uuid, uuid, text, text, uuid, uuid) to authenticated;

-- ── Beheer: correctie toevoegen ───────────────────────────────────────────────────────────
-- p = {action: adjust|void|add, shift_id?, staff_id?, clock_in_at?, clock_out_at?, reason}
create or replace function public.kassa_shift_correct(p_tenant_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_action text := p ->> 'action';
  v_shift uuid := nullif(p ->> 'shift_id', '')::uuid;
  v_staff uuid := nullif(p ->> 'staff_id', '')::uuid;
  v_in timestamptz := nullif(p ->> 'clock_in_at', '')::timestamptz;
  v_out timestamptz := nullif(p ->> 'clock_out_at', '')::timestamptz;
  v_id uuid;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_action not in ('adjust', 'void', 'add') then raise exception 'onbekende correctie' using errcode = '22023'; end if;
  if v_action in ('adjust', 'void') then
    select s.staff_id into v_staff from public.kassa_shifts s where s.id = v_shift and s.tenant_id = p_tenant_id;
    if v_staff is null then raise exception 'shift niet gevonden' using errcode = 'P0002'; end if;
  else
    v_shift := null;
    if not exists (select 1 from public.pos_cashiers c where c.id = v_staff and c.tenant_id = p_tenant_id) then
      raise exception 'medewerker niet gevonden' using errcode = 'P0002';
    end if;
  end if;
  if v_action = 'void' then v_in := null; v_out := null; end if;
  if v_action <> 'void' then
    if v_in is null or v_out is null or v_out <= v_in then raise exception 'begin en einde ongeldig' using errcode = '22023'; end if;
    if v_out - v_in > interval '24 hours' then raise exception 'een shift duurt hoogstens 24 uur' using errcode = '22023'; end if;
    if v_out > now() + interval '5 minutes' then raise exception 'einde ligt in de toekomst' using errcode = '22023'; end if;
  end if;
  insert into public.kassa_shift_corrections (tenant_id, shift_id, staff_id, action, clock_in_at, clock_out_at, reason)
    values (p_tenant_id, v_shift, v_staff, v_action, v_in, v_out, btrim(coalesce(p ->> 'reason', '')))
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.kassa_shift_correct(uuid, jsonb) from public, anon;
grant execute on function public.kassa_shift_correct(uuid, jsonb) to authenticated;

-- ── Beheer: urenrapport ───────────────────────────────────────────────────────────────────
-- Shifts van een periode (max. 93 dagen) met hun bedrijfsdag, de medewerkers, en de fooien per
-- bedrijfsdag (zelfde definitie als de X/Z-rapporten: check_payments.tip_cents + online fooi).
create or replace function public.kassa_hours_report(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '93 days' then
    raise exception 'periode ongeldig (max. 93 dagen)' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'now', now(),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.display_name, 'employee_no', c.employee_no,
                                                           'role', c.role, 'is_active', c.is_active) order by c.display_name)
                       from public.pos_cashiers c where c.tenant_id = p_tenant_id), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(jsonb_build_object(
                          'id', e.id, 'staff_id', e.staff_id, 'source', e.source, 'clock_in_at', e.clock_in_at, 'clock_out_at', e.clock_out_at,
                          'original_in', e.original_in, 'original_out', e.original_out, 'voided', e.voided, 'corrected', e.corrected,
                          'reason', e.reason, 'corrected_at', e.corrected_at,
                          'business_day', public.kassa_business_day(p_tenant_id, e.clock_in_at)) order by e.clock_in_at)
                        from public.kassa_shifts_effective(p_tenant_id, p_from, p_to) e), '[]'::jsonb),
    'tips', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'cents', cents) order by d)
                      from (select public.kassa_business_day(p_tenant_id, at) as d, sum(cents)::bigint as cents from (
                              select cp.created_at as at, cp.tip_cents::bigint as cents
                                from public.check_payments cp
                                join public.pos_transactions t on t.id = cp.pos_transaction_id and t.status = 'completed'
                               where cp.tenant_id = p_tenant_id and cp.tip_cents > 0 and cp.created_at >= p_from and cp.created_at < p_to
                              union all
                              select o.paid_at, o.tip_cents::bigint from public.check_online_payments o
                               where o.tenant_id = p_tenant_id and o.status = 'paid' and o.tip_cents > 0 and o.paid_at >= p_from and o.paid_at < p_to
                            ) z group by 1) q), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.kassa_hours_report(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.kassa_hours_report(uuid, timestamptz, timestamptz) to authenticated;

comment on table public.kassa_shifts is 'PERSONEEL-2: gewerkte shifts (in/uitklokken aan SellQo Kassa). Enkel afsluiten mag; correcties in kassa_shift_corrections.';
comment on table public.kassa_shift_corrections is 'PERSONEEL-2: correcties op shifts door de zaakvoerder, append-only; de laatste per shift wint.';

-- KASSA-RECHTEN-1 — korting, "van het huis", het annuleren van verstuurde lijnen en "kas uit" enkel
-- met het akkoord van een eigenaar of verantwoordelijke. Inclusief review 1 (1-11-2026).
--
-- Tot nu toe controleerden horeca_apply en kassa_cash_move enkel has_tenant_role (tenant_admin/staff):
-- elke kassamedewerker kon −50 %, gratis, een verstuurde lijn annuleren of geld uit de lade nemen. Nu:
--   - Aanmelden met PIN (kassa_staff_login) geeft een sessietoken (willekeurig, enkel gehasht bewaard in
--     kassa_staff_sessions: zaak, medewerker, toestel; vervalt op het einde van de bedrijfsdag of bij
--     Wissel/vergrendelen via kassa_staff_logout). Het toestel houdt het in het geheugen.
--   - Een eigenaar/verantwoordelijke (actief, can_use_pos) doet de handeling meteen, maar ENKEL met een
--     geldig sessietoken van precies die medewerker (staff_token in het commando). Een staff_id alleen
--     volstaat niet meer.
--   - Anders moet het commando een approval_id dragen: een eenmalig akkoord dat kassa_approve uitreikt na
--     de PIN van een owner/manager. Het akkoord is gebonden aan actie + rekening + lijn + bedrag
--     (percent/amount_cents) of aantal (qty bij annuleren) en is 5 minuten geldig (kas uit: 30 minuten,
--     omdat het na het ondertekenen nog door de wachtrij kan moeten). Zelfde PIN-controle en lockout als
--     kassa_product_quick_edit (KASSA-0.6); elke foute PIN en elk akkoord in fiscal_audit_log.
--     Waarom een apart akkoord en niet de PIN in het commando: een foute PIN binnen horeca_apply rolt mee
--     terug (subtransactie per commando), dan telt de lockout niet en is een PIN met 50 commando's per
--     aanroep te raden. En zo komt er nooit een PIN in de wachtrij op het toestel.
--   - Review 1, blokker: change_qty op een lijn met korting (price_changes), een correctie of een
--     tegenboeking wordt geweigerd (anders: 10× gratis, dan 9× min = een negatieve rekening).
--
-- Fiscaal: niets verandert aan de events (P/ORDER, correcties, PRICE_CHANGE, MONEY_IN_OUT blijven
-- identiek); dit zijn extra voorwaarden vóór de bestaande takken. Ontwerp-lijnen weghalen en "kas in"
-- blijven vrij.
--
-- Aanpak: horeca_apply_one, kassa_cash_move en kassa_staff_login worden uitgebreid via
-- pg_get_functiondef + replace (elk anker precies één keer, nagetrokken op de live DB 1-11-2026), zoals
-- KASSA-UX-4, zodat andere patches (o.a. KEUKEN-VEILIG-1) behouden blijven. Idempotent via de marker
-- 'KASSA-RECHTEN-1' per functie.
--
-- Handmatig terugdraaien (laat andere patches staan; NIET de snapshot terugzetten, die mist latere patches):
--   1. Per functie het ingevoegde blok weer weghalen:
--      do $r$ declare d text; b text; begin
--        d := pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure);
--        b := substring(d from E'(  -- KASSA-RECHTEN-1: korting/van het huis.*?  end if;\n\n)');
--        d := replace(d, b, '');
--        b := substring(d from E'(    -- KASSA-RECHTEN-1: niet het aantal.*?end if;\n)');
--        execute replace(d, b, '');
--        d := pg_get_functiondef('public.kassa_cash_move(uuid, text, jsonb)'::regprocedure);
--        b := substring(d from E'(  -- KASSA-RECHTEN-1: kas uit.*?  end if;\n)');
--        execute replace(d, b, '');
--        d := pg_get_functiondef('public.kassa_staff_login(uuid, text, text)'::regprocedure);
--        execute replace(d, E',\n    -- KASSA-RECHTEN-1: sessietoken (enkel gehasht bewaard).\n    ''session'', public.kassa_staff_session_start(c.tenant_id, c.id, p_device_id)', '');
--      end $r$;
--      (controleer daarna met position('KASSA-RECHTEN-1' in pg_get_functiondef(...)) = 0)
--   2. drop function if exists public.kassa_require_approval(uuid, uuid, jsonb), public.kassa_approve(uuid, text, jsonb),
--        public.kassa_staff_logout(uuid, text), public.kassa_staff_session_start(uuid, uuid, text), public.kassa_staff_session_valid(uuid, uuid, text);
--      drop table if exists public.kassa_approvals, public.kassa_staff_sessions;
--   De definities van vóór deze migratie staan ter controle in snapshots.sellqo_20261101_fn_kassa_rechten_1.

-- 0. Snapshot vóór de patch (enkel ter controle) -------------------------------------------------
create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261101_fn_kassa_rechten_1 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as md5, now() as taken_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('horeca_apply_one', 'kassa_cash_move', 'kassa_staff_login');
revoke all on snapshots.sellqo_20261101_fn_kassa_rechten_1 from anon, authenticated;

-- 1. Sessietokens van de kassa ------------------------------------------------------------------
create table if not exists public.kassa_staff_sessions (
  token_hash text primary key,                       -- sha256(hex) van het token; het token zelf staat nergens
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.pos_cashiers(id) on delete cascade,
  device_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
comment on table public.kassa_staff_sessions is 'KASSA-RECHTEN-1: sessie van een medewerker na de PIN (token gehasht). Een owner/manager doet korting/annuleren/kas uit enkel met een geldig token.';
create index if not exists kassa_staff_sessions_staff on public.kassa_staff_sessions (tenant_id, staff_id, expires_at desc);
alter table public.kassa_staff_sessions enable row level security;
revoke all on public.kassa_staff_sessions from anon, authenticated;

-- Nieuw token voor een medewerker (enkel vanuit kassa_staff_login). Vervalt op het einde van de bedrijfsdag.
create or replace function public.kassa_staff_session_start(p_tenant_id uuid, p_staff_id uuid, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_until timestamptz := public.kassa_day_start(p_tenant_id, public.kassa_business_day(p_tenant_id, now()) + 1);
begin
  -- Opruimen: verlopen of ingetrokken sessies van deze zaak ouder dan een dag.
  delete from public.kassa_staff_sessions where tenant_id = p_tenant_id and coalesce(revoked_at, expires_at) < now() - interval '1 day';
  insert into public.kassa_staff_sessions (token_hash, tenant_id, staff_id, device_id, expires_at)
    values (encode(digest(v_token, 'sha256'), 'hex'), p_tenant_id, p_staff_id, left(coalesce(p_device_id, ''), 200), v_until);
  return jsonb_build_object('token', v_token, 'expires_at', v_until);
end;
$$;
revoke all on function public.kassa_staff_session_start(uuid, uuid, text) from public, anon, authenticated;

-- Is dit token een geldige sessie van precies deze medewerker van deze zaak?
create or replace function public.kassa_staff_session_valid(p_tenant_id uuid, p_staff_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select coalesce(p_token, '') ~ '^[0-9a-f]{64}$' and exists (
    select 1 from public.kassa_staff_sessions s
     where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
       and s.tenant_id = p_tenant_id and s.staff_id = p_staff_id
       and s.revoked_at is null and s.expires_at > now());
$$;
revoke all on function public.kassa_staff_session_valid(uuid, uuid, text) from public, anon, authenticated;

-- Wissel / vergrendelen: het token van dit toestel intrekken. Onbekend token = niets (geen fout).
create or replace function public.kassa_staff_logout(p_tenant_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then return; end if;
  update public.kassa_staff_sessions set revoked_at = now()
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') and tenant_id = p_tenant_id and revoked_at is null;
end;
$$;
revoke all on function public.kassa_staff_logout(uuid, text) from public, anon;
grant execute on function public.kassa_staff_logout(uuid, text) to authenticated;

-- kassa_staff_login: bij een geslaagde PIN ook een sessietoken ('session': {token, expires_at}).
do $patch$
declare
  d text := pg_get_functiondef('public.kassa_staff_login(uuid, text, text)'::regprocedure);
  anchor text := E'    ''employee_id'', v_insz\n  );';
  repl text := E'    ''employee_id'', v_insz,\n'
            || E'    -- KASSA-RECHTEN-1: sessietoken (enkel gehasht bewaard).\n'
            || E'    ''session'', public.kassa_staff_session_start(c.tenant_id, c.id, p_device_id)\n  );';
begin
  if position('KASSA-RECHTEN-1' in d) > 0 then raise notice 'KASSA-RECHTEN-1: kassa_staff_login al gepatcht'; return; end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KASSA-RECHTEN-1: anker employee_id niet precies één keer gevonden in kassa_staff_login';
  end if;
  execute replace(d, anchor, repl);
end
$patch$;

-- 2. Eenmalige akkoorden ------------------------------------------------------------------------
create table if not exists public.kassa_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action text not null,
  check_id uuid,
  line_id uuid,
  percent numeric,
  amount_cents bigint,
  qty integer,
  approver_id uuid not null references public.pos_cashiers(id) on delete cascade,
  staff_id uuid references public.pos_cashiers(id) on delete set null,
  device_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  command_id uuid
);
alter table public.kassa_approvals add column if not exists percent numeric;
alter table public.kassa_approvals add column if not exists amount_cents bigint;
alter table public.kassa_approvals add column if not exists qty integer;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.kassa_approvals'::regclass and conname = 'kassa_approvals_action_check2') then
    alter table public.kassa_approvals drop constraint if exists kassa_approvals_action_check;
    alter table public.kassa_approvals add constraint kassa_approvals_action_check2 check (action in ('discount', 'void_sent', 'cash_out'));
  end if;
end
$mig$;
comment on table public.kassa_approvals is 'KASSA-RECHTEN-1: eenmalig akkoord van een eigenaar/verantwoordelijke (PIN) voor korting, annuleren van een verstuurde lijn of kas uit; gebonden aan bedrag/aantal.';
create index if not exists kassa_approvals_tenant on public.kassa_approvals (tenant_id, created_at desc);
alter table public.kassa_approvals enable row level security;
-- Geen policies: enkel de security-definer-functies hieronder lezen en schrijven.
revoke all on public.kassa_approvals from anon, authenticated;

-- 3. Akkoord uitreiken na de PIN van een owner/manager ------------------------------------------
-- p = {staff_id, approver_id, pin, action: discount|void_sent|cash_out, check_id, line_id, percent, amount_cents, qty}
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
  v_action text := p ->> 'action';
  v_check uuid;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p, 'null'::jsonb)) <> 'object' then
    raise exception 'geen akkoord gevraagd' using errcode = '22023';
  end if;
  if coalesce(p ->> 'approver_id', '') !~ '^[0-9a-f-]{36}$' or coalesce(v_action, '') not in ('discount', 'void_sent', 'cash_out')
     or (v_action <> 'cash_out' and coalesce(p ->> 'check_id', '') !~ '^[0-9a-f-]{36}$')
     or (nullif(p ->> 'line_id', '') is not null and (p ->> 'line_id') !~ '^[0-9a-f-]{36}$') then
    raise exception 'goedkeurder, actie en rekening zijn verplicht' using errcode = '22023';
  end if;
  -- Waar het akkoord over gaat, ligt vast: korting = percent of bedrag, annuleren = aantal, kas uit = bedrag.
  if v_action = 'discount' and (coalesce(p ->> 'percent', '') !~ '^[0-9]{1,3}(\.[0-9]+)?$') = (coalesce(p ->> 'amount_cents', '') !~ '^[0-9]{1,9}$') then
    raise exception 'korting: percent of bedrag' using errcode = '22023';
  end if;
  if v_action = 'void_sent' and coalesce(p ->> 'qty', '') !~ '^[0-9]{1,4}$' then raise exception 'annuleren: aantal verplicht' using errcode = '22023'; end if;
  if v_action = 'cash_out' and coalesce(p ->> 'amount_cents', '') !~ '^[0-9]{1,9}$' then raise exception 'kas uit: bedrag verplicht' using errcode = '22023'; end if;
  if v_action <> 'cash_out' then
    v_check := (p ->> 'check_id')::uuid;
    if not exists (select 1 from public.dining_checks d where d.id = v_check and d.tenant_id = p_tenant_id) then
      raise exception 'rekening niet gevonden' using errcode = 'P0002';
    end if;
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
  -- Opruimen: akkoorden van deze zaak ouder dan een dag (het spoor blijft in fiscal_audit_log).
  delete from public.kassa_approvals where tenant_id = p_tenant_id and created_at < now() - interval '1 day';
  insert into public.kassa_approvals (tenant_id, action, check_id, line_id, percent, amount_cents, qty, approver_id, staff_id, device_id, expires_at)
    values (p_tenant_id, v_action, v_check, nullif(p ->> 'line_id', '')::uuid,
            case when v_action = 'discount' then nullif(p ->> 'percent', '')::numeric end,
            case when v_action in ('discount', 'cash_out') then nullif(p ->> 'amount_cents', '')::bigint end,
            case when v_action = 'void_sent' then (p ->> 'qty')::integer end,
            c.id, v_by, left(coalesce(p_device_id, ''), 120),
            now() + case when v_action = 'cash_out' then interval '30 minutes' else interval '5 minutes' end)
    returning id into v_id;
  insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
    values (p_tenant_id, auth.uid(), left(coalesce(p_device_id, ''), 120), 'kassa_approval',
      jsonb_build_object('approval_id', v_id, 'action', v_action, 'check_id', v_check, 'line_id', nullif(p ->> 'line_id', ''),
                         'percent', p -> 'percent', 'amount_cents', p -> 'amount_cents', 'qty', p -> 'qty',
                         -- Wie het vroeg: null als het toestel geen (geldige) medewerker meegaf, nooit stil de goedkeurder.
                         'approver_id', c.id, 'staff_id', v_by));
  return jsonb_build_object('ok', true, 'approval_id', v_id, 'approver_name', c.display_name);
end;
$$;
revoke all on function public.kassa_approve(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_approve(uuid, text, jsonb) to authenticated;

-- 4. Controle (niet rechtstreeks uitvoerbaar) ---------------------------------------------------
-- cmd = het commando (kind discount_line|void_line|cash_out, id, staff_id, staff_token, approval_id,
-- line_id, percent, amount_cents, qty). p_check_id = de rekening (null bij kas uit).
create or replace function public.kassa_require_approval(p_tenant_id uuid, p_check_id uuid, cmd jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_staff uuid := nullif(cmd ->> 'staff_id', '')::uuid;
  v_action text := case cmd ->> 'kind' when 'discount_line' then 'discount' when 'cash_out' then 'cash_out' else 'void_sent' end;
  v_line uuid := nullif(cmd ->> 'line_id', '')::uuid;
  a public.kassa_approvals%rowtype;
begin
  -- Eigenaar of verantwoordelijke zelf aan de kassa: meteen, maar enkel met een geldig sessietoken van
  -- precies die medewerker (een staff_id alleen bewijst niets).
  if v_staff is not null and exists (select 1 from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id
                                       and s.is_active and coalesce(s.can_use_pos, true) and s.role in ('owner', 'manager'))
     and public.kassa_staff_session_valid(p_tenant_id, v_staff, cmd ->> 'staff_token') then
    return;
  end if;
  if coalesce(cmd ->> 'approval_id', '') !~ '^[0-9a-f-]{36}$' then
    raise exception 'akkoord van een eigenaar of verantwoordelijke nodig' using errcode = '42501';
  end if;
  select * into a from public.kassa_approvals x where x.id = (cmd ->> 'approval_id')::uuid and x.tenant_id = p_tenant_id for update;
  if a.id is null or a.used_at is not null or a.expires_at < now() or a.action <> v_action
     or a.check_id is distinct from p_check_id or a.line_id is distinct from v_line
     -- Gebonden aan wat goedgekeurd werd: geen −10 % goedkeuren en −100 % doen.
     or (v_action = 'discount' and (a.percent is distinct from nullif(cmd ->> 'percent', '')::numeric
                                    or (a.percent is null and a.amount_cents is distinct from nullif(cmd ->> 'amount_cents', '')::bigint)))
     or (v_action = 'void_sent' and a.qty is distinct from nullif(cmd ->> 'qty', '')::integer)
     or (v_action = 'cash_out' and a.amount_cents is distinct from nullif(cmd ->> 'amount_cents', '')::bigint) then
    raise exception 'akkoord ongeldig, verlopen of voor iets anders: vraag het opnieuw' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pos_cashiers s where s.id = a.approver_id and s.tenant_id = p_tenant_id
                   and s.is_active and coalesce(s.can_use_pos, true) and s.role in ('owner', 'manager')) then
    raise exception 'de goedkeurder is geen eigenaar of verantwoordelijke meer' using errcode = '42501';
  end if;
  -- Eenmalig. Wordt het commando verderop geweigerd, dan rolt dit mee terug (subtransactie) en
  -- blijft het akkoord bruikbaar voor hetzelfde tot het verloopt.
  update public.kassa_approvals set used_at = now(), command_id = nullif(cmd ->> 'id', '')::uuid where id = a.id;
end;
$$;
revoke all on function public.kassa_require_approval(uuid, uuid, jsonb) from public, anon, authenticated;

-- 5. horeca_apply_one: de controle vóór de commando-takken + geen aantal wijzigen op een kortingslijn
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure);
  a1 text := E'  if v_kind = ''add_line'' then\n';
  gate text := E'  -- KASSA-RECHTEN-1: korting/van het huis en annuleren van een verstuurde lijn enkel met akkoord\n'
            || E'  -- van een eigenaar of verantwoordelijke (zelf aan de kassa met sessietoken, of via kassa_approve).\n'
            || E'  if v_kind = ''discount_line'' or (v_kind = ''void_line'' and exists (select 1 from public.check_lines x\n'
            || E'       where x.id = nullif(cmd ->> ''line_id'', '''')::uuid and x.check_id = c.id and x.state = ''sent'')) then\n'
            || E'    perform public.kassa_require_approval(p_tenant_id, c.id, cmd);\n'
            || E'  end if;\n\n';
  a2 text := $a$if l.state <> 'draft' then raise exception 'een verstuurde lijn wijzig je met annuleren' using errcode = '55000'; end if;$a$;
  qtyg text := a2 || E'\n'
            || E'    -- KASSA-RECHTEN-1: niet het aantal van een lijn met korting, correctie of tegenboeking (anders\n'
            || E'    -- wordt "10× gratis" na 9× min een negatieve rekening). Weghalen kan wel (void_line haalt het paar weg).\n'
            || E'    if jsonb_array_length(coalesce(l.price_changes, ''[]''::jsonb)) > 0 or l.corrects_line_id is not null or l.neg_reason is not null then\n'
            || E'      raise exception ''op deze lijn staat een korting of correctie: haal de lijn weg en tik opnieuw'' using errcode = ''55000'';\n'
            || E'    end if;\n';
begin
  if position('KASSA-RECHTEN-1' in d) > 0 then
    raise notice 'KASSA-RECHTEN-1: horeca_apply_one al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'KASSA-RECHTEN-1: anker add_line niet precies één keer gevonden in horeca_apply_one';
  end if;
  if (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'KASSA-RECHTEN-1: anker change_qty niet precies één keer gevonden in horeca_apply_one';
  end if;
  d := replace(d, a1, gate || a1);
  execute replace(d, a2, qtyg);
end
$patch$;

-- 6. kassa_cash_move: kas uit met akkoord (kas in blijft vrij) ----------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.kassa_cash_move(uuid, text, jsonb)'::regprocedure);
  anchor text := $a$  v_session := public.kassa_open_session(p_tenant_id, v_terminal, 0, 'Automatisch geopend door SellQo Kassa (kas in/uit)');$a$;
  gate text := E'  -- KASSA-RECHTEN-1: kas uit enkel door een eigenaar/verantwoordelijke (sessietoken) of met hun akkoord.\n'
            || E'  if v_dir = ''out'' then\n'
            || E'    perform public.kassa_require_approval(p_tenant_id, null, jsonb_build_object(''kind'', ''cash_out'', ''id'', v_id, ''staff_id'', v_staff,\n'
            || E'      ''staff_token'', p ->> ''staff_token'', ''approval_id'', p ->> ''approval_id'', ''amount_cents'', v_amount));\n'
            || E'  end if;\n';
begin
  if position('KASSA-RECHTEN-1' in d) > 0 then
    raise notice 'KASSA-RECHTEN-1: kassa_cash_move al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KASSA-RECHTEN-1: anker kassa_open_session niet precies één keer gevonden in kassa_cash_move';
  end if;
  execute replace(d, anchor, gate || anchor);
end
$patch$;

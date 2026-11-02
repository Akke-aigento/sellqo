-- KASSA-ACCOUNT-1a — een eigen identiteit per kassatoestel (optie D uit docs/kassa-account-1-plan.md).
--
-- Tot nu toe meldde de kassa zich aan met een gewone SellQo-account (live: altijd een tenant_admin). Elk toestel
-- draaide dus met eigenaarsrechten: prijzen via REST, klanten, facturen, Odoo-mappings ... Nu:
--   - Elk toestel krijgt een eigen auth-user, BUITEN user_roles. Zonder user_roles-rij geven
--     get_user_tenant_ids() en has_tenant_role() niets terug: de toestelaccount staat in geen enkele bestaande
--     policy (default-deny). Enkel wat hieronder expliciet openstaat, mag het toestel.
--   - kassa_device_accounts: koppeling toestel-user → zaak + kassa (pos_terminals) + device_uuid (ID-07).
--     Intrekken = revoked_at; elke controle leest die rij, dus ontkoppelen werkt meteen.
--   - kassa_pair_codes: eenmalige koppelcode (6 cijfers) of QR-token, 10 minuten geldig, gebonden aan zaak +
--     kassa. Enkel gehasht bewaard. Aanmaken: kassa_pair_code_create (enkel tenant_admin). Inruilen: edge
--     function kassa-device-pair (service role) via kassa_pair_claim / kassa_pair_complete / kassa_pair_release.
--     Rate limit (review 1): 5 fouten per IP per 15 minuten (code én QR-token). Platformbreed weigert niets: boven 300
--     fouten in 15 minuten worden alle open 6-cijfercodes ongeldig gemaakt (het QR-token van die codes blijft werken),
--     zodat andermans fouten nooit een juiste code doen weigeren, en raden over veel IP's niets oplevert.
--     Een toestel-ID (device_uuid) dat al actief gekoppeld is, wordt niet overgenomen: 'device_already_paired'
--     (beheer ontkoppelt eerst). can_create_tenant weigert toestelaccounts (ankerpatch, review 1).
--   - kassa_can_operate(tenant[, device]): has_tenant_role(tenant_admin, staff) OF een niet-ingetrokken toestel van
--     die zaak. Met device: voor een toestelaccount moet p_device_id gelijk zijn aan zijn device_uuid.
--     De tenant_admin/staff-tak blijft tijdens de overgang (KASSA-ACCOUNT-2 haalt hem weg waar beheer hem niet nodig heeft).
--   - Ankerpatch op de 26 kassa-RPC's die de kassa aanroept (het plan telde er 27; live nagetrokken 2-11-2026:
--     26 functies): has_tenant_role(p_tenant_id, array['tenant_admin','staff']) → kassa_can_operate(...).
--     Elk anker precies één keer, marker 'KASSA-ACCOUNT-1' (idempotent), zoals KASSA-RECHTEN-1.
--   - Additieve policies (to authenticated, tenant_id = kassa_device_tenant()) op de tabellen die de kassa
--     rechtstreeks leest of schrijft (plan §1.2). GEEN policy op orders, customers, invoices, tenants,
--     user_roles, product_variants, products UPDATE ...: die blijven voor het toestel dicht.
--   - kassa_device_context(): zaak (enkel de velden die de kassa toont), kassa en toestel, voor het toestel zelf.
--   - kassa_kitchen_orders(tenant): smalle lijst webshop-/QR-bestellingen voor het keukenbord, i.p.v. een
--     orders-select (geen e-mail, adres enkel straat/nummer/postcode/gemeente bij levering).
--   - kassa_device_unpair_self(): het toestel ontkoppelt zichzelf (menu "Ontkoppel dit toestel").
--
-- Fiscaal: geen enkel event of FDM-bericht verandert. deviceId (ID-07) blijft de device_uuid van het toestel,
-- nu server-side gebonden aan één account + kassa.
-- Geen secrets in deze migratie. Geen wijziging aan get_user_tenant_ids, has_tenant_role, app_role of een
-- bestaande policy (strikt additief).
--
-- Handmatig terugdraaien (laat andere patches staan; NIET de snapshot terugzetten, die mist latere patches):
--   1. Per gepatchte functie de vervanging terugzetten:
--      do $r$ declare r record; d text; begin
--        for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace
--                   and position('KASSA-ACCOUNT-1' in pg_get_functiondef(p.oid)) > 0
--                   and p.proname not like 'kassa_device%' and p.proname not like 'kassa_pair%'
--                   and p.proname not in ('kassa_can_operate', 'kassa_kitchen_orders') loop
--          d := pg_get_functiondef(r.oid);
--          d := replace(d, '/* KASSA-ACCOUNT-1 */ public.kassa_can_operate(p_tenant_id, p_device_id)', 'public.has_tenant_role(p_tenant_id, array[''tenant_admin'', ''staff'']::public.app_role[])');
--          d := replace(d, '/* KASSA-ACCOUNT-1 */ public.kassa_can_operate(p_tenant_id)', 'public.has_tenant_role(p_tenant_id, array[''tenant_admin'', ''staff'']::public.app_role[])');
--          d := replace(d, '/* KASSA-ACCOUNT-1 */ public.kassa_can_operate(c.tenant_id, p_device_id)', 'public.has_tenant_role(c.tenant_id, array[''tenant_admin'',''staff'']::public.app_role[])');
--          d := replace(d, ' /* KASSA-ACCOUNT-1 */ or coalesce(public.kassa_device_tenant() = p_tenant_id, false)', '');
--          execute d;
--        end loop;
--      end $r$;
--      (controleer daarna: geen functie meer met 'KASSA-ACCOUNT-1' behalve de nieuwe hieronder)
--   2. Policies weg: select format('drop policy %I on public.%I;', policyname, tablename) from pg_policies
--        where schemaname = 'public' and policyname like 'kassa\_device\_%' and tablename <> 'kassa_device_accounts';
--      (en de uitvoer draaien; LET OP: zonder de backslashes vangt de LIKE ook het bestaande kassa_devices_select)
--   3. drop function if exists public.kassa_kitchen_orders(uuid), public.kassa_device_context(),
--        public.kassa_device_unpair_self(), public.kassa_pair_code_create(uuid, uuid, text),
--        public.kassa_pair_claim(text, text, text), public.kassa_pair_complete(uuid, uuid, text, text),
--        public.kassa_pair_release(uuid), public.kassa_can_operate(uuid, text), public.kassa_can_operate(uuid),
--        public.kassa_device_terminal(), public.kassa_device_tenant();
--      drop table if exists public.kassa_pair_attempts, public.kassa_pair_codes, public.kassa_device_accounts;
--   3b. can_create_tenant: de ingevoegde regel weer weghalen:
--      do $r$ declare d text := pg_get_functiondef('public.can_create_tenant(uuid, text)'::regprocedure); begin
--        execute replace(d, E'    ) < 10\n    /* KASSA-ACCOUNT-1 */ AND NOT EXISTS (SELECT 1 FROM public.kassa_device_accounts a WHERE a.user_id = _user_id)\n    AND coalesce(auth.jwt() -> ''app_metadata'' ->> ''kind'', '''') <> ''kassa'';', '    ) < 10;');
--      end $r$;
--   4. Toestel-auth-users (app_metadata.kind = 'kassa') bannen of verwijderen via de auth-admin.
--   De definities van vóór deze migratie staan ter controle in snapshots.sellqo_20261102_fn_kassa_account_1.
--
-- Lokale test (scripts/gks/sql/run.sh): de testdatabank kent niet alle live tabellen en functies. Met
-- `set sellqo.kassa_account_test = on` slaat de migratie ontbrekende objecten over (met een NOTICE).
-- Live staat die instelling nooit aan: daar is elk ontbrekend object een fout.

-- 0. Snapshot vóór de patch (enkel ter controle) -------------------------------------------------
create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_fn_kassa_account_1 as
  select p.oid::regprocedure::text as sig, pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as md5, now() as taken_at
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('horeca_apply', 'horeca_pay', 'horeca_pay_begin', 'horeca_pay_release', 'horeca_snapshot',
       'horeca_table_request_accept', 'horeca_table_request_reject', 'horeca_table_call_handle', 'kassa_staff_login',
       'kassa_staff_logout', 'kassa_approve', 'kassa_product_quick_edit', 'kassa_cash_move', 'kassa_shift',
       'kassa_report_finish', 'kassa_report_begin', 'kassa_report_due', 'kassa_report_source', 'kassa_report_release',
       'kassa_clock', 'kassa_clock_state', 'kassa_my_shift', 'kassa_heartbeat', 'horeca_notify_device_save',
       'horeca_notify_device_remove', 'horeca_notify_devices_list', 'can_create_tenant', 'record_stock_movement');
revoke all on snapshots.sellqo_20261102_fn_kassa_account_1 from anon, authenticated;

-- 1. Toestelaccounts -------------------------------------------------------------------------------
create table if not exists public.kassa_device_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  terminal_id uuid not null references public.pos_terminals(id) on delete cascade,
  device_uuid text not null check (device_uuid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  name text not null default '',
  paired_by uuid,
  paired_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid
);
comment on table public.kassa_device_accounts is 'KASSA-ACCOUNT-1: eigen auth-user per kassatoestel (niet in user_roles). revoked_at = ontkoppeld; elke kassacontrole leest deze rij.';
-- Eén actieve koppeling per toestel-ID, over alle zaken (review 1: geen overname van een toestel-ID).
create unique index if not exists kassa_device_accounts_active_device on public.kassa_device_accounts (device_uuid) where revoked_at is null;
create index if not exists kassa_device_accounts_terminal on public.kassa_device_accounts (terminal_id);
alter table public.kassa_device_accounts enable row level security;
revoke all on public.kassa_device_accounts from anon, authenticated;
grant select on public.kassa_device_accounts to authenticated;
drop policy if exists kassa_device_accounts_select on public.kassa_device_accounts;
create policy kassa_device_accounts_select on public.kassa_device_accounts for select to authenticated
  using (user_id = auth.uid() or public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
-- Schrijven enkel via de functies hieronder en de edge functions (service role).

-- 2. Koppelcodes en pogingen -----------------------------------------------------------------------
create table if not exists public.kassa_pair_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  terminal_id uuid not null references public.pos_terminals(id) on delete cascade,
  code_hash text not null,          -- sha256 van de 6 cijfers
  token_hash text not null,         -- sha256 van het QR-token (64 hex)
  name text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,              -- geclaimd (kassa_pair_claim)
  used_by uuid                      -- de toestel-user die eruit voortkwam (kassa_pair_complete)
);
comment on table public.kassa_pair_codes is 'KASSA-ACCOUNT-1: eenmalige koppelcode voor een kassatoestel (10 min). Enkel hashes; geen grants.';
create unique index if not exists kassa_pair_codes_code_open on public.kassa_pair_codes (code_hash) where used_at is null;
create unique index if not exists kassa_pair_codes_token on public.kassa_pair_codes (token_hash);
alter table public.kassa_pair_codes enable row level security;
revoke all on public.kassa_pair_codes from anon, authenticated;

create table if not exists public.kassa_pair_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
comment on table public.kassa_pair_attempts is 'KASSA-ACCOUNT-1: pogingen om een koppelcode in te ruilen (IP enkel gehasht), voor de rate limit.';
create index if not exists kassa_pair_attempts_ip on public.kassa_pair_attempts (ip_hash, created_at desc);
create index if not exists kassa_pair_attempts_time on public.kassa_pair_attempts (created_at desc);
alter table public.kassa_pair_attempts enable row level security;
revoke all on public.kassa_pair_attempts from anon, authenticated;

-- 3. Helpers ---------------------------------------------------------------------------------------
-- Zaak van het aangemelde toestel (null voor elke andere gebruiker of een ingetrokken toestel).
create or replace function public.kassa_device_tenant()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.tenant_id from public.kassa_device_accounts a where a.user_id = auth.uid() and a.revoked_at is null;
$$;
revoke all on function public.kassa_device_tenant() from public, anon;
grant execute on function public.kassa_device_tenant() to authenticated;

create or replace function public.kassa_device_terminal()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.terminal_id from public.kassa_device_accounts a where a.user_id = auth.uid() and a.revoked_at is null;
$$;
revoke all on function public.kassa_device_terminal() from public, anon;
grant execute on function public.kassa_device_terminal() to authenticated;

-- Mag de aanroeper de kassa van deze zaak bedienen? Overgang: tenant_admin/staff nog wel (tot KASSA-ACCOUNT-2).
create or replace function public.kassa_can_operate(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[])
      or (p_tenant_id is not null and exists (
            select 1 from public.kassa_device_accounts a
             where a.user_id = auth.uid() and a.revoked_at is null and a.tenant_id = p_tenant_id));
$$;
revoke all on function public.kassa_can_operate(uuid) from public, anon;
grant execute on function public.kassa_can_operate(uuid) to authenticated;

-- Idem, en voor een toestelaccount moet p_device_id zijn eigen device_uuid zijn (geen vrije tekst meer).
create or replace function public.kassa_can_operate(p_tenant_id uuid, p_device_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[])
      or (p_tenant_id is not null and exists (
            select 1 from public.kassa_device_accounts a
             where a.user_id = auth.uid() and a.revoked_at is null and a.tenant_id = p_tenant_id
               and a.device_uuid = lower(coalesce(p_device_id, ''))));
$$;
revoke all on function public.kassa_can_operate(uuid, text) from public, anon;
grant execute on function public.kassa_can_operate(uuid, text) to authenticated;

-- 4. Koppelcode aanmaken (beheer, enkel tenant_admin) ---------------------------------------------
-- Antwoord: {code: '123456', token: <64 hex>, expires_at, terminal_name}. Een nieuwe code voor dezelfde kassa
-- vervangt de vorige, nog niet gebruikte code.
create or replace function public.kassa_pair_code_create(p_tenant_id uuid, p_terminal_id uuid, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_terminal record;
  v_code text;
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_until timestamptz := now() + interval '10 minutes';
  v_try int := 0;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  select id, name into v_terminal from public.pos_terminals
   where id = p_terminal_id and tenant_id = p_tenant_id and settings ->> 'virtual' is null;
  if v_terminal.id is null then
    raise exception 'kassa niet gevonden' using errcode = 'P0002';
  end if;
  -- Opruimen: verlopen codes (alle zaken) en de open code van deze kassa.
  delete from public.kassa_pair_codes where expires_at < now() - interval '1 day';
  delete from public.kassa_pair_codes where terminal_id = p_terminal_id and used_at is null;
  loop
    v_try := v_try + 1;
    v_code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    begin
      insert into public.kassa_pair_codes (tenant_id, terminal_id, code_hash, token_hash, name, created_by, expires_at)
        values (p_tenant_id, p_terminal_id, encode(digest('kassa-pair|' || v_code, 'sha256'), 'hex'),
                encode(digest('kassa-pair|' || v_token, 'sha256'), 'hex'),
                left(coalesce(nullif(btrim(p_name), ''), v_terminal.name), 60), auth.uid(), v_until);
      exit;
    exception when unique_violation then
      -- Zelfde 6 cijfers als een andere open code (ook een verlopen, nog niet opgeruimde): opnieuw.
      if v_try >= 20 then raise; end if;
    end;
  end loop;
  return jsonb_build_object('code', v_code, 'token', v_token, 'expires_at', v_until, 'terminal_name', v_terminal.name);
end;
$$;
revoke all on function public.kassa_pair_code_create(uuid, uuid, text) from public, anon;
grant execute on function public.kassa_pair_code_create(uuid, uuid, text) to authenticated;

-- 5. Koppelcode inruilen (enkel de edge function kassa-device-pair, service role) -----------------
-- p_secret = 6 cijfers of het 64-hex QR-token; p_ip = IP van de aanroeper (wordt hier gehasht).
-- p_device_uuid = het toestel dat wil koppelen: al actief gekoppeld = niet claimen (reason device_already_paired).
-- Antwoord: {ok: true, code_id, tenant_id, terminal_id, terminal_name, name} of
--           {ok: false, reason: invalid|rate_limited|device_already_paired}.
drop function if exists public.kassa_pair_claim(text, text);  -- vorige vorm van deze (nog niet live) migratie
create or replace function public.kassa_pair_claim(p_secret text, p_ip text, p_device_uuid text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_ip text := encode(digest('kassa-ip|' || coalesce(p_ip, ''), 'sha256'), 'hex');
  v_secret text := lower(btrim(coalesce(p_secret, '')));
  v_hash text;
  v_row public.kassa_pair_codes%rowtype;
  v_name text;
  v_dev text := lower(btrim(coalesce(p_device_uuid, '')));
begin
  -- Eén aanroep per IP tegelijk (anders telt de limiet niet bij gelijktijdige pogingen).
  perform pg_advisory_xact_lock(hashtextextended('kassa-pair|' || v_ip, 0));
  delete from public.kassa_pair_attempts where created_at < now() - interval '1 day';
  -- Per IP: 5 fouten per 15 minuten, voor de 6 cijfers én het QR-token.
  if (select count(*) from public.kassa_pair_attempts where ip_hash = v_ip and not ok and created_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  if v_secret ~ '^[0-9]{6}$' or v_secret ~ '^[0-9a-f]{64}$' then
    v_hash := encode(digest('kassa-pair|' || v_secret, 'sha256'), 'hex');
    select * into v_row from public.kassa_pair_codes c
     where (case when length(v_secret) = 6 then c.code_hash else c.token_hash end) = v_hash
       and c.used_at is null and c.expires_at > now()
     for update;
  end if;
  if v_row.id is null then
    insert into public.kassa_pair_attempts (ip_hash, ok) values (v_ip, false);
    -- Platformbrede rem: niemand weigeren, wel alle open 6-cijfercodes ongeldig maken (raden over veel IP's).
    -- Het QR-token van die codes blijft geldig; de code_hash wordt een waarde die geen invoer kan treffen.
    if (select count(*) from public.kassa_pair_attempts where not ok and created_at > now() - interval '15 minutes') >= 300 then
      update public.kassa_pair_codes set code_hash = 'ongeldig:' || id::text
       where used_at is null and expires_at > now() and code_hash not like 'ongeldig:%';
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  -- Overname van een toestel-ID weigeren: beheer moet eerst ontkoppelen. De code blijft geldig.
  if exists (select 1 from public.kassa_device_accounts a where a.device_uuid = v_dev and a.revoked_at is null) then
    insert into public.kassa_pair_attempts (ip_hash, ok) values (v_ip, true);
    return jsonb_build_object('ok', false, 'reason', 'device_already_paired');
  end if;
  update public.kassa_pair_codes set used_at = now() where id = v_row.id;
  insert into public.kassa_pair_attempts (ip_hash, ok) values (v_ip, true);
  select name into v_name from public.pos_terminals where id = v_row.terminal_id;
  return jsonb_build_object('ok', true, 'code_id', v_row.id, 'tenant_id', v_row.tenant_id, 'terminal_id', v_row.terminal_id,
    'terminal_name', v_name, 'name', v_row.name);
end;
$$;
revoke all on function public.kassa_pair_claim(text, text, text) from public, anon, authenticated;
grant execute on function public.kassa_pair_claim(text, text, text) to service_role;

-- Na het aanmaken van de toestel-user: de koppeling vastleggen. Is het toestel-ID intussen (race) al actief
-- gekoppeld, dan fout KA409 'device_already_paired' (geen overname; beheer ontkoppelt eerst).
-- Antwoord: {ok: true} of een fout.
create or replace function public.kassa_pair_complete(p_code_id uuid, p_user_id uuid, p_device_uuid text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.kassa_pair_codes%rowtype;
  v_dev text := lower(btrim(coalesce(p_device_uuid, '')));
begin
  select * into v_row from public.kassa_pair_codes where id = p_code_id for update;
  if v_row.id is null or v_row.used_at is null or v_row.used_by is not null or v_row.used_at < now() - interval '5 minutes' then
    raise exception 'koppelcode niet (meer) geldig' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kassa_device_accounts a where a.device_uuid = v_dev and a.revoked_at is null) then
    raise exception 'device_already_paired' using errcode = 'KA409';
  end if;
  insert into public.kassa_device_accounts (user_id, tenant_id, terminal_id, device_uuid, name, paired_by)
    values (p_user_id, v_row.tenant_id, v_row.terminal_id, v_dev,
            left(coalesce(nullif(btrim(p_name), ''), v_row.name), 60), v_row.created_by);
  update public.kassa_pair_codes set used_by = p_user_id where id = v_row.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.kassa_pair_complete(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.kassa_pair_complete(uuid, uuid, text, text) to service_role;

-- Aanmaken van de user mislukt: de code weer vrijgeven (zolang ze niet verlopen of gebruikt is).
create or replace function public.kassa_pair_release(p_code_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.kassa_pair_codes set used_at = null where id = p_code_id and used_by is null and expires_at > now();
$$;
revoke all on function public.kassa_pair_release(uuid) from public, anon, authenticated;
grant execute on function public.kassa_pair_release(uuid) to service_role;

-- 6. Het toestel zelf ------------------------------------------------------------------------------
-- Context voor de kassa-app: zaak (enkel wat de kassa toont: naam, taal, adres/btw voor het ticket, IBAN voor de
-- overschrijvings-QR), kassa en toestel. null = deze sessie is geen (actief) kassatoestel.
create or replace function public.kassa_device_context()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
      'device', jsonb_build_object('user_id', a.user_id, 'device_uuid', a.device_uuid, 'name', a.name, 'paired_at', a.paired_at),
      'terminal', jsonb_build_object('id', pt.id, 'name', pt.name, 'settings', pt.settings, 'status', pt.status),
      'tenant', jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'language', t.language,
        'business_modules', t.business_modules, 'currency', t.currency, 'logo_url', t.logo_url,
        'billing_company_name', t.billing_company_name, 'address', t.address, 'postal_code', t.postal_code,
        'city', t.city, 'country', t.country, 'btw_number', t.btw_number, 'iban', t.iban, 'bic', t.bic))
    into v
    from public.kassa_device_accounts a
    join public.pos_terminals pt on pt.id = a.terminal_id
    join public.tenants t on t.id = a.tenant_id
   where a.user_id = auth.uid() and a.revoked_at is null;
  return v;
end;
$$;
revoke all on function public.kassa_device_context() from public, anon;
grant execute on function public.kassa_device_context() to authenticated;

-- "Ontkoppel dit toestel" vanuit de kassa: koppeling intrekken en de pushtokens van dit toestel weg.
create or replace function public.kassa_device_unpair_self()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n int;
begin
  update public.kassa_device_accounts set revoked_at = now(), revoked_by = auth.uid()
   where user_id = auth.uid() and revoked_at is null;
  get diagnostics n = row_count;
  if n > 0 then delete from public.device_tokens where user_id = auth.uid(); end if;
  return n > 0;
end;
$$;
revoke all on function public.kassa_device_unpair_self() from public, anon;
grant execute on function public.kassa_device_unpair_self() to authenticated;

-- Keukenbord op het toestel: enkel de velden die het bord toont (zelfde venster als useKitchenBoard: 3 dagen,
-- max. 300). Geen e-mail; adres enkel bij levering en enkel straat/nummer/postcode/gemeente.
create or replace function public.kassa_kitchen_orders(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v jsonb;
begin
  if not public.kassa_can_operate(p_tenant_id) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v
    from (
      select o.created_at, jsonb_build_object(
          'id', o.id, 'order_number', o.order_number, 'created_at', o.created_at, 'service_type', o.service_type,
          'requested_time', o.requested_time, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
          'notes', o.notes, 'total', o.total, 'payment_status', o.payment_status, 'payment_method', o.payment_method,
          'status', o.status, 'table_label', o.table_label,
          'shipping_address', case when o.service_type = 'local_delivery' and jsonb_typeof(o.shipping_address) = 'object' then
              jsonb_strip_nulls(jsonb_build_object('street', o.shipping_address ->> 'street', 'house_number', o.shipping_address ->> 'house_number',
                'postal_code', o.shipping_address ->> 'postal_code', 'city', o.shipping_address ->> 'city')) end,
          'order_items', coalesce((
            select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'variant_title', oi.variant_title,
                     'quantity', oi.quantity, 'addons', oi.addons,
                     'products', case when p.id is null then null else jsonb_build_object('allergens', p.allergens) end)
                   order by oi.created_at, oi.id)
              from public.order_items oi
              left join public.products p on p.id = oi.product_id and p.tenant_id = o.tenant_id
             where oi.order_id = o.id), '[]'::jsonb)) as j
        from public.orders o
       where o.tenant_id = p_tenant_id and o.service_type is not null and o.created_at >= now() - interval '3 days'
       order by o.created_at desc
       limit 300
    ) x;
  return v;
end;
$$;
revoke all on function public.kassa_kitchen_orders(uuid) from public, anon;
grant execute on function public.kassa_kitchen_orders(uuid) to authenticated;

-- 7. Ankerpatch op de kassa-RPC's -----------------------------------------------------------------
do $patch$
declare
  r record;
  d text;
  n int;
  tolerant boolean := coalesce(current_setting('sellqo.kassa_account_test', true), '') = 'on';
  a_std text := 'public.has_tenant_role(p_tenant_id, array[''tenant_admin'', ''staff'']::public.app_role[])';
  a_login text := 'public.has_tenant_role(c.tenant_id, array[''tenant_admin'',''staff'']::public.app_role[])';
  a_snap text := 'p_tenant_id in (select public.get_user_tenant_ids(auth.uid()))';
begin
  for r in select * from (values
      -- (signatuur, anker, vervanging)
      ('public.horeca_apply(uuid, text, jsonb)', a_std, 'dev'),
      ('public.horeca_pay(uuid, text, jsonb)', a_std, 'dev'),
      ('public.horeca_pay_begin(uuid, text, jsonb)', a_std, 'dev'),
      ('public.horeca_pay_release(uuid, uuid, uuid)', a_std, 'std'),
      ('public.horeca_table_request_accept(uuid, text, uuid, uuid)', a_std, 'dev'),
      ('public.horeca_table_request_reject(uuid, uuid, uuid, text)', a_std, 'std'),
      ('public.horeca_table_call_handle(uuid, uuid, uuid)', a_std, 'std'),
      ('public.kassa_staff_logout(uuid, text)', a_std, 'std'),
      ('public.kassa_approve(uuid, text, jsonb)', a_std, 'dev'),
      ('public.kassa_product_quick_edit(uuid, text, jsonb)', a_std, 'dev'),
      ('public.kassa_cash_move(uuid, text, jsonb)', a_std, 'dev'),
      ('public.kassa_shift(uuid, text, jsonb)', a_std, 'dev'),
      ('public.kassa_report_begin(uuid, text, jsonb)', a_std, 'dev'),
      ('public.kassa_report_finish(uuid, text, jsonb)', a_std, 'dev'),
      ('public.kassa_report_due(uuid)', a_std, 'std'),
      ('public.kassa_report_source(uuid, uuid, text)', a_std, 'dev'),
      ('public.kassa_report_release(uuid, uuid)', a_std, 'std'),
      ('public.kassa_clock(uuid, uuid, text, text, uuid, uuid)', a_std, 'dev'),
      ('public.kassa_clock_state(uuid, uuid)', a_std, 'std'),
      ('public.kassa_my_shift(uuid, uuid)', a_std, 'std'),
      ('public.kassa_heartbeat(uuid, uuid, text, jsonb)', a_std, 'dev'),
      ('public.horeca_notify_device_save(uuid, text, text, text, text[], uuid[], boolean, text)', a_std, 'std'),
      ('public.horeca_notify_device_remove(uuid, text)', a_std, 'std'),
      ('public.horeca_notify_devices_list(uuid)', a_std, 'std'),
      ('public.kassa_staff_login(uuid, text, text)', a_login, 'login'),
      ('public.horeca_snapshot(uuid)', a_snap, 'snap')
    ) v(sig, anchor, kind)
  loop
    if to_regprocedure(r.sig) is null then
      if tolerant then raise notice 'KASSA-ACCOUNT-1: % ontbreekt (testmodus, overgeslagen)', r.sig; continue; end if;
      raise exception 'KASSA-ACCOUNT-1: functie % ontbreekt', r.sig;
    end if;
    d := pg_get_functiondef(to_regprocedure(r.sig));
    if position('KASSA-ACCOUNT-1' in d) > 0 then raise notice 'KASSA-ACCOUNT-1: % al gepatcht', r.sig; continue; end if;
    n := (length(d) - length(replace(d, r.anchor, ''))) / length(r.anchor);
    if n <> 1 then
      raise exception 'KASSA-ACCOUNT-1: anker niet precies één keer gevonden in % (%×)', r.sig, n;
    end if;
    d := replace(d, r.anchor, case r.kind
      when 'dev' then '/* KASSA-ACCOUNT-1 */ public.kassa_can_operate(p_tenant_id, p_device_id)'
      when 'std' then '/* KASSA-ACCOUNT-1 */ public.kassa_can_operate(p_tenant_id)'
      when 'login' then '/* KASSA-ACCOUNT-1 */ public.kassa_can_operate(c.tenant_id, p_device_id)'
      -- coalesce: zonder koppeling is kassa_device_tenant() null, en `not (false or null)` is null = géén weigering.
      when 'snap' then r.anchor || ' /* KASSA-ACCOUNT-1 */ or coalesce(public.kassa_device_tenant() = p_tenant_id, false)'
    end);
    execute d;
  end loop;
end
$patch$;

-- 8. Additieve policies voor het toestel (default-deny: enkel deze) -------------------------------
do $pol$
declare
  r record;
  tolerant boolean := coalesce(current_setting('sellqo.kassa_account_test', true), '') = 'on';
  dev constant text := 'tenant_id = (select public.kassa_device_tenant())';
  devid constant text := 'device_id = (select a.device_uuid from public.kassa_device_accounts a where a.user_id = auth.uid() and a.revoked_at is null)';
begin
  for r in select * from (values
      -- (tabel, bewerking, using, with check)
      ('pos_terminals', 'select', 'id = (select public.kassa_device_terminal())', null),
      ('pos_cashiers', 'select', dev, null),
      ('pos_sessions', 'select', dev, null),
      ('products', 'select', dev, null),
      ('categories', 'select', dev, null),
      ('product_categories', 'select', 'exists (select 1 from public.products p where p.id = product_categories.product_id and p.tenant_id = (select public.kassa_device_tenant()))', null),
      ('product_addon_groups', 'select', dev, null),
      ('product_addon_options', 'select', dev, null),
      ('vat_rates', 'select', dev, null),
      ('check_lines', 'select', dev, null),
      ('check_online_payments', 'select', dev, null),
      ('kitchen_tickets', 'select', dev, null),
      ('kitchen_tickets', 'insert', null, dev),
      ('kitchen_tickets', 'update', dev, dev),
      ('prep_stations', 'select', dev, null),
      ('prep_station_routes', 'select', dev, null),
      ('horeca_state', 'select', dev, null),
      ('table_requests', 'select', dev, null),
      ('table_calls', 'select', dev, null),
      ('kassa_reports', 'select', dev, null),
      ('horeca_pay_settings', 'select', dev, null),
      ('fulfillment_settings', 'select', dev, null),
      ('reservation_settings', 'select', dev, null),
      ('dining_areas', 'select', dev, null),
      ('dining_tables', 'select', dev, null),
      ('floor_markers', 'select', dev, null),
      ('table_reservations', 'select', dev, null),
      ('table_reservations', 'insert', null, dev),
      ('table_reservations', 'update', dev, dev),
      ('fiscal_events', 'select', dev, null),
      -- Review 1: ook device_id gebonden aan het eigen toestel (terminal_id niet: dat is de fiscale terminal-ID
      -- uit pos_terminals.settings, niet de pos_terminals.id; zie Vervolg ACCOUNT-2).
      ('fiscal_events', 'insert', null, 'created_by = auth.uid() and ' || dev || ' and ' || devid || ' and public.tenant_has_business_module(tenant_id, ''horeca''::text)'),
      ('fiscal_audit_log', 'insert', null, 'actor_id = auth.uid() and ' || dev || ' and ' || devid),
      ('horeca_notify_devices', 'select', dev, null),
      ('printers', 'select', dev, null),
      ('print_jobs', 'select', dev, null)
    ) v(tbl, cmd, using_expr, check_expr)
  loop
    if to_regclass('public.' || r.tbl) is null then
      if tolerant then raise notice 'KASSA-ACCOUNT-1: tabel % ontbreekt (testmodus, overgeslagen)', r.tbl; continue; end if;
      raise exception 'KASSA-ACCOUNT-1: tabel % ontbreekt', r.tbl;
    end if;
    execute format('drop policy if exists %I on public.%I', 'kassa_device_' || r.tbl || '_' || r.cmd, r.tbl);
    execute format('create policy %I on public.%I for %s to authenticated%s%s',
      'kassa_device_' || r.tbl || '_' || r.cmd, r.tbl, r.cmd,
      case when r.using_expr is null then '' else ' using (' || r.using_expr || ')' end,
      case when r.check_expr is null then '' else ' with check (' || r.check_expr || ')' end);
  end loop;
end
$pol$;

-- 9. Review 1: een toestelaccount maakt nooit een winkel aan (policy "Authenticated users can insert their own
-- tenant" en de edge function create-tenant gebruiken can_create_tenant). Ankerpatch, anker precies één keer.
do $patch$
declare
  sig constant text := 'public.can_create_tenant(uuid, text)';
  d text;
  anchor constant text := E'    ) < 10;';
  repl constant text := E'    ) < 10\n    /* KASSA-ACCOUNT-1 */ AND NOT EXISTS (SELECT 1 FROM public.kassa_device_accounts a WHERE a.user_id = _user_id)\n    AND coalesce(auth.jwt() -> ''app_metadata'' ->> ''kind'', '''') <> ''kassa'';';
begin
  if to_regprocedure(sig) is null then
    if coalesce(current_setting('sellqo.kassa_account_test', true), '') = 'on' then raise notice 'KASSA-ACCOUNT-1: % ontbreekt (testmodus)', sig; return; end if;
    raise exception 'KASSA-ACCOUNT-1: functie % ontbreekt', sig;
  end if;
  d := pg_get_functiondef(to_regprocedure(sig));
  if position('KASSA-ACCOUNT-1' in d) > 0 then raise notice 'KASSA-ACCOUNT-1: % al gepatcht', sig; return; end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KASSA-ACCOUNT-1: anker niet precies één keer gevonden in %', sig;
  end if;
  execute replace(d, anchor, repl);
end
$patch$;

-- 10. PRIJS-GATEN-2 (live sinds 2-11-2026, migratie 20261102091000) laat in record_stock_movement enkel nog
-- leden (get_user_tenant_ids) én tenant_admin/staff/warehouse boeken. Een toestelaccount haalt geen van beide,
-- en het kassapad horeca_pay → insert pos_transactions → trigger handle_pos_transaction_stock → decrement_stock
-- / decrement_variant_stock → record_stock_movement(..., 'sale') loopt onder de JWT van het toestel: zonder deze
-- patch faalt elke verkoop met 42501 en draait de hele betaling terug. (handle_pos_refund_stock zet de voorraad
-- rechtstreeks, buiten record_stock_movement: niet geraakt.)
-- Toegelaten voor een actief toestel van precies die winkel: enkel reason 'sale' en 'return' (de CHECK op
-- stock_movements kent: sale, return, purchase, sync, manual, opening, adjustment). Nooit manual/adjustment/
-- opening/purchase/sync. bulk_adjust_stock blijft dicht voor toestellen (ongemoeid).
-- Drift: stopt als de body afwijkt van de live versie na PRIJS-GATEN-2 (prosrc-md5 b1a4331d…, 2-11-2026).
-- Handmatig terugdraaien: beide ingevoegde regels ' /* KASSA-ACCOUNT-1 */ AND NOT (…)' weer weghalen
-- (replace op pg_get_functiondef, zoals hieronder maar omgekeerd).
do $patch$
declare
  sig constant text := 'public.record_stock_movement(uuid, uuid, uuid, integer, text, text, uuid, text, uuid)';
  -- Lidmaatschapscheck: een actief toestel van deze winkel gaat door naar de rolcheck (die geeft 42501 voor
  -- elke andere reden dan sale/return); de rolcheck laat het toestel enkel door voor sale/return.
  dev1 constant text := E'\n     /* KASSA-ACCOUNT-1 */ AND NOT coalesce(public.kassa_device_tenant() = v_tenant_id, false)';
  dev2 constant text := E'\n     /* KASSA-ACCOUNT-1 */ AND NOT (p_reason IN (''sale'', ''return'') AND coalesce(public.kassa_device_tenant() = v_tenant_id, false))';
  a1 constant text := E'     AND v_tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid()))';
  a2 constant text := E'     AND NOT public.has_tenant_role(v_tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role, ''warehouse''::app_role])';
  d text;
  src text;
begin
  if to_regprocedure(sig) is null then
    if coalesce(current_setting('sellqo.kassa_account_test', true), '') = 'on' then raise notice 'KASSA-ACCOUNT-1: % ontbreekt (testmodus)', sig; return; end if;
    raise exception 'KASSA-ACCOUNT-1: functie % ontbreekt', sig;
  end if;
  select prosrc into src from pg_proc where oid = to_regprocedure(sig);
  if position('KASSA-ACCOUNT-1' in src) > 0 then raise notice 'KASSA-ACCOUNT-1: record_stock_movement al gepatcht'; return; end if;
  if md5(src) <> 'b1a4331d6673d75ddd188cfdd826467f' then
    raise exception 'KASSA-ACCOUNT-1: record_stock_movement wijkt af van de live versie na PRIJS-GATEN-2 (md5 %); eerst nalezen', md5(src);
  end if;
  d := pg_get_functiondef(to_regprocedure(sig));
  if (length(d) - length(replace(d, a1 || ' THEN', ''))) / length(a1 || ' THEN') <> 1
     or (length(d) - length(replace(d, a2 || ' THEN', ''))) / length(a2 || ' THEN') <> 1 then
    raise exception 'KASSA-ACCOUNT-1: ankers niet precies één keer gevonden in record_stock_movement';
  end if;
  d := replace(d, a1 || ' THEN', a1 || dev1 || ' THEN');
  d := replace(d, a2 || ' THEN', a2 || dev2 || ' THEN');
  execute d;
end
$patch$;

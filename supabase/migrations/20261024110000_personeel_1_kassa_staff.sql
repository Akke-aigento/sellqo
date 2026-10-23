-- PERSONEEL-1 (23-10-2026): kassapersoneel met PIN, rol, nummer en INSZ (GKS 2.0).
-- Eisenmatrix: USR-01, USR-02, USR-03, USR-05, USR-06.
--
-- Bouwt verder op de bestaande (ongebruikte, 0 rijen op 23-10) tabel pos_cashiers.
-- Strikt additief qua kolommen. Rechten worden STRENGER: pin_hash en insz_encrypted zijn
-- niet meer leesbaar voor `authenticated`, en schrijven gaat enkel nog via de functies
-- hieronder (die de tenant en de rol controleren). Niets in de app las of schreef
-- pos_cashiers rechtstreeks (grep 23-10: enkel types.ts).
--
-- INSZ (rijksregisternummer) wordt versleuteld bewaard (pgcrypto, sleutel in Supabase Vault,
-- door deze migratie zelf aangemaakt: de sleutel staat dus nooit in de repo). Hij komt enkel
-- terug bij een geslaagde PIN-login op een kassatoestel, omdat het toestel hem in elk
-- FDM-bericht als employeeId moet meesturen. Nooit op een ticket of in een scherm.
--
-- Idempotent. Terugdraaien (handmatig):
--   drop function if exists public.kassa_staff_save(uuid, uuid, text, text, integer, text, boolean, boolean, text);
--   drop function if exists public.kassa_staff_set_insz(uuid, text);
--   drop function if exists public.kassa_staff_login(uuid, text, text);
--   drop function if exists public.kassa_insz_key(); drop function if exists public.kassa_valid_insz(text);
--   alter table public.pos_cashiers drop column if exists role, drop column if exists employee_no, ...;
--   (de Vault-sleutel 'kassa_insz_key' NIET wissen zolang er versleutelde INSZ bestaan)

alter table public.pos_cashiers
  add column if not exists role text not null default 'waiter',
  add column if not exists employee_no integer,
  add column if not exists can_use_pos boolean not null default true,
  add column if not exists insz_encrypted bytea,
  add column if not exists insz_set_at timestamptz,
  add column if not exists failed_pin_attempts integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz;

do $$ begin
  alter table public.pos_cashiers add constraint pos_cashiers_role_chk
    check (role in ('owner','manager','waiter','bartender','kitchen','technician'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pos_cashiers add constraint pos_cashiers_employee_no_chk check (employee_no is null or employee_no between 1 and 9999);
exception when duplicate_object then null; end $$;
create unique index if not exists pos_cashiers_tenant_employee_no_uq on public.pos_cashiers (tenant_id, employee_no) where employee_no is not null;

-- Sleutel in Vault, eenmalig aangemaakt (willekeurig, 32 bytes).
do $$
begin
  set local search_path to public, extensions;
  if not exists (select 1 from vault.secrets where name = 'kassa_insz_key') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'kassa_insz_key', 'SellQo Kassa: versleuteling INSZ personeel (PERSONEEL-1)');
  end if;
end $$;

create or replace function public.kassa_insz_key()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'kassa_insz_key' limit 1;
$$;
revoke all on function public.kassa_insz_key() from public, anon, authenticated;

-- INSZ: 11 cijfers, controle 97 − (eerste 9 mod 97), met '2' ervoor voor geboren vanaf 2000.
create or replace function public.kassa_valid_insz(p text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select p ~ '^\d{11}$' and (
    97 - (substr(p, 1, 9)::bigint % 97) = substr(p, 10, 2)::int
    or 97 - (('2' || substr(p, 1, 9))::bigint % 97) = substr(p, 10, 2)::int
  );
$$;

-- Personeelslid aanmaken of wijzigen. Enkel tenant_admin (of platformadmin) van die zaak.
create or replace function public.kassa_staff_save(
  p_tenant_id uuid,
  p_id uuid,
  p_display_name text,
  p_role text,
  p_employee_no integer,
  p_avatar_color text,
  p_can_use_pos boolean,
  p_is_active boolean,
  p_pin text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_id uuid;
  v_no integer := p_employee_no;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if coalesce(btrim(p_display_name), '') = '' or char_length(p_display_name) > 60 then
    raise exception 'naam ongeldig' using errcode = '22023';
  end if;
  if p_pin is not null and p_pin !~ '^\d{4,6}$' then
    raise exception 'pincode moet 4 tot 6 cijfers zijn' using errcode = '22023';
  end if;
  if p_avatar_color is not null and p_avatar_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'kleur ongeldig' using errcode = '22023';
  end if;
  if v_no is null then
    select coalesce(max(employee_no), 0) + 1 into v_no from public.pos_cashiers where tenant_id = p_tenant_id;
  end if;

  if p_id is null then
    if p_pin is null then
      raise exception 'pincode verplicht voor een nieuw personeelslid' using errcode = '22023';
    end if;
    insert into public.pos_cashiers (tenant_id, display_name, pin_hash, avatar_color, is_active, role, employee_no, can_use_pos)
    values (p_tenant_id, btrim(p_display_name), crypt(p_pin, gen_salt('bf')), coalesce(p_avatar_color, '#3b82f6'),
            coalesce(p_is_active, true), coalesce(p_role, 'waiter'), v_no, coalesce(p_can_use_pos, true))
    returning id into v_id;
  else
    update public.pos_cashiers set
      display_name = btrim(p_display_name),
      avatar_color = coalesce(p_avatar_color, avatar_color),
      is_active = coalesce(p_is_active, is_active),
      role = coalesce(p_role, role),
      employee_no = v_no,
      can_use_pos = coalesce(p_can_use_pos, can_use_pos),
      pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end,
      failed_pin_attempts = case when p_pin is null then failed_pin_attempts else 0 end,
      locked_until = case when p_pin is null then locked_until else null end,
      updated_at = now()
    where id = p_id and tenant_id = p_tenant_id
    returning id into v_id;
    if v_id is null then
      raise exception 'personeelslid niet gevonden' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.kassa_staff_save(uuid, uuid, text, text, integer, text, boolean, boolean, text) from public, anon;
grant execute on function public.kassa_staff_save(uuid, uuid, text, text, integer, text, boolean, boolean, text) to authenticated;

-- INSZ zetten (of wissen met null). Enkel tenant_admin. Ongeldig = fout.
create or replace function public.kassa_staff_set_insz(p_cashier_id uuid, p_insz text)
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_tenant uuid;
  v_key text;
  v_at timestamptz;
begin
  select tenant_id into v_tenant from public.pos_cashiers where id = p_cashier_id;
  if v_tenant is null or not public.has_tenant_role(v_tenant, array['tenant_admin']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_insz is null then
    update public.pos_cashiers set insz_encrypted = null, insz_set_at = null, updated_at = now() where id = p_cashier_id;
    return null;
  end if;
  if not public.kassa_valid_insz(p_insz) then
    raise exception 'rijksregisternummer ongeldig' using errcode = '22023';
  end if;
  v_key := public.kassa_insz_key();
  if v_key is null then
    raise exception 'sleutel ontbreekt' using errcode = 'P0001';
  end if;
  v_at := now();
  update public.pos_cashiers
    set insz_encrypted = pgp_sym_encrypt(p_insz, v_key, 'cipher-algo=aes256'), insz_set_at = v_at, updated_at = v_at
    where id = p_cashier_id;
  return v_at;
end;
$$;
revoke all on function public.kassa_staff_set_insz(uuid, text) from public, anon;
grant execute on function public.kassa_staff_set_insz(uuid, text) to authenticated;

-- PIN-login op een kassatoestel (USR-01). Het toestel is aangemeld met een SellQo-account
-- van de zaak (tenant_admin of staff). 5 foute pogingen = 5 minuten geblokkeerd.
-- Antwoord bij succes: profiel + employee_id (INSZ, ontsleuteld) voor de FDM-berichten.
create or replace function public.kassa_staff_login(p_cashier_id uuid, p_pin text, p_device_id text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  c public.pos_cashiers%rowtype;
  v_insz text;
begin
  select * into c from public.pos_cashiers where id = p_cashier_id for update;
  if c.id is null or not public.has_tenant_role(c.tenant_id, array['tenant_admin','staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if not c.is_active or not c.can_use_pos then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', c.locked_until);
  end if;
  if p_pin is null or c.pin_hash <> crypt(p_pin, c.pin_hash) then
    update public.pos_cashiers set
      failed_pin_attempts = case when c.failed_pin_attempts + 1 >= 5 then 0 else c.failed_pin_attempts + 1 end,
      locked_until = case when c.failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
    where id = c.id;
    insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
      values (c.tenant_id, auth.uid(), left(p_device_id, 200), 'pin_failed', jsonb_build_object('staff_id', c.id, 'attempt', c.failed_pin_attempts + 1));
    return jsonb_build_object('ok', false, 'reason', case when c.failed_pin_attempts + 1 >= 5 then 'locked' else 'wrong_pin' end,
      'attempts_left', greatest(0, 4 - c.failed_pin_attempts));
  end if;
  if c.insz_encrypted is not null then
    v_insz := pgp_sym_decrypt(c.insz_encrypted, public.kassa_insz_key());
  end if;
  update public.pos_cashiers set failed_pin_attempts = 0, locked_until = null, last_login_at = now() where id = c.id;
  return jsonb_build_object(
    'ok', true,
    'staff', jsonb_build_object('id', c.id, 'display_name', c.display_name, 'role', c.role, 'employee_no', c.employee_no, 'avatar_color', c.avatar_color),
    'employee_id', v_insz
  );
end;
$$;
revoke all on function public.kassa_staff_login(uuid, text, text) from public, anon;
grant execute on function public.kassa_staff_login(uuid, text, text) to authenticated;

-- Rechten op de tabel: lezen zonder geheimen; schrijven enkel via de functies.
revoke all on public.pos_cashiers from anon;
revoke insert, update, delete, truncate, references, trigger on public.pos_cashiers from authenticated;
revoke select on public.pos_cashiers from authenticated;
grant select (id, tenant_id, display_name, avatar_color, is_active, created_at, updated_at, role, employee_no,
  can_use_pos, insz_set_at, locked_until, last_login_at) on public.pos_cashiers to authenticated;

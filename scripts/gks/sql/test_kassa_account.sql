\set ON_ERROR_STOP 1
-- KASSA-ACCOUNT-1a — eigen identiteit per kassatoestel. Draait als laatste (na test_kassa_nachtrun.sql) en na
-- 20261102100000_kassa_account_1.sql. Zaak B (22222222-…, Els = eigenaar …b1, Tom = ober …b2, PIN 1234,
-- kassa "Toog" 5e…b1, eigenaar-account aaaaaaaa-…0002), zaak A (11111111-…) is "een andere winkel".
-- Rol-impersonatie: set role authenticated + request.jwt.claim.sub (lokale auth.uid()) én request.jwt.claims
-- (zoals live), zodat dezelfde blokken ook via query_database na de uitrol kunnen draaien.
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;
create or replace function pg_temp.rows(sql text) returns bigint language plpgsql as $$ declare n bigint; begin execute 'select count(*) from (' || sql || ') x' into n; return n; end $$;
create or replace function pg_temp.affected(sql text) returns bigint language plpgsql as $$ declare n bigint; begin execute sql; get diagnostics n = row_count; return n; end $$;

-- Herhaalbaar (lokaal debuggen): eigen testrijen van een vorige run weg.
delete from public.kassa_device_accounts; delete from public.kassa_pair_codes; delete from public.kassa_pair_attempts;
do $$ begin if to_regclass('public.device_tokens') is not null then delete from public.device_tokens; end if; end $$;
do $$ begin if to_regclass('public.order_items') is not null then delete from public.order_items; delete from public.customers; delete from public.invoices; end if; end $$;
delete from public.kitchen_tickets where order_id = '0d000000-0000-0000-0000-0000000000b1';

-- ── Opzet: live-gelijke RLS op de tabellen die het toestel NIET mag, plus stubs voor orders/klanten/facturen ──
alter table public.tenants add column if not exists language text, add column if not exists currency text default 'EUR',
  add column if not exists logo_url text, add column if not exists billing_company_name text, add column if not exists country text default 'BE',
  add column if not exists iban text, add column if not exists bic text, add column if not exists owner_email text, add column if not exists stripe_account_id text;
update public.tenants set business_modules = array['horeca'], iban = 'BE68539007547034', owner_email = 'els@b.test', stripe_account_id = 'acct_geheim', language = 'nl'
 where id = '22222222-2222-2222-2222-222222222222';
alter table public.tenants enable row level security;
drop policy if exists t_members on public.tenants;
create policy t_members on public.tenants for select to authenticated using (id in (select public.get_user_tenant_ids(auth.uid())));
alter table public.user_roles enable row level security;
drop policy if exists ur_own on public.user_roles;
create policy ur_own on public.user_roles for select to authenticated using (user_id = auth.uid());
grant insert on public.user_roles to authenticated;
drop policy if exists ur_admin_insert on public.user_roles;
create policy ur_admin_insert on public.user_roles for insert to authenticated with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
alter table public.products enable row level security;
drop policy if exists p_sel on public.products;
create policy p_sel on public.products for select to authenticated using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists p_upd on public.products;
create policy p_upd on public.products for update to public using ((tenant_id in (select public.get_user_tenant_ids(auth.uid()))) and public.has_tenant_role(tenant_id, array['tenant_admin','staff','warehouse','marketing']::public.app_role[]));
grant select, update on public.product_variants to authenticated;
alter table public.product_variants enable row level security;
drop policy if exists pv_sel on public.product_variants;
create policy pv_sel on public.product_variants for select to authenticated using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists pv_upd on public.product_variants;
create policy pv_upd on public.product_variants for update to authenticated using ((tenant_id in (select public.get_user_tenant_ids(auth.uid()))) and public.has_tenant_role(tenant_id, array['tenant_admin','staff','warehouse']::public.app_role[]));
insert into public.product_variants (id, product_id, tenant_id, title, price) values ('f0000000-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'Groot', 5) on conflict do nothing;
alter table public.kitchen_tickets enable row level security;
drop policy if exists kt_members on public.kitchen_tickets;
create policy kt_members on public.kitchen_tickets for all to public using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())))
  with check (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));
grant select, insert, update on public.kitchen_tickets to authenticated;
alter table public.pos_terminals enable row level security;
drop policy if exists pt_sel on public.pos_terminals;
create policy pt_sel on public.pos_terminals for select to authenticated using (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin','staff']::public.app_role[]));
grant select on public.pos_terminals to authenticated;
create table if not exists public.orders (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, order_number text, service_type text, requested_time timestamptz,
  customer_name text, customer_email text, customer_phone text, notes text, total numeric, payment_status text, payment_method text, status text,
  shipping_address jsonb, table_label text, created_at timestamptz not null default now());
create table if not exists public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null, product_id uuid, product_name text, variant_title text, quantity int, addons jsonb, created_at timestamptz not null default now());
create table if not exists public.customers (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, email text);
create table if not exists public.invoices (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, total numeric);
create table if not exists public.device_tokens (id uuid primary key default gen_random_uuid(), user_id uuid not null, tenant_id uuid, token text);
alter table public.products add column if not exists allergens text[] not null default '{}';
alter table public.pos_terminals add column if not exists status text not null default 'active';
do $$ declare t text; begin
  foreach t in array array['orders', 'customers', 'invoices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists m_sel on public.%I', t);
    execute format('create policy m_sel on public.%I for select to authenticated using (tenant_id in (select public.get_user_tenant_ids(auth.uid())))', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
alter table public.order_items enable row level security;
grant select on public.order_items to authenticated;
alter table public.device_tokens enable row level security;
drop policy if exists dt_own on public.device_tokens;
create policy dt_own on public.device_tokens for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, delete on public.device_tokens to authenticated;
insert into public.orders (id, tenant_id, order_number, service_type, customer_name, customer_email, customer_phone, total, payment_status, payment_method, status, shipping_address)
values ('0d000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'B-1', 'local_delivery', 'Jan Peeters', 'jan@klant.test', '0470', 12, 'paid', 'card', 'pending',
        '{"street":"Kerkstraat","house_number":"1","postal_code":"3000","city":"Leuven","email":"jan@klant.test","phone":"0470"}'),
       ('0d000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'A-1', 'pickup', 'Anna', 'anna@klant.test', null, 8, 'paid', 'card', 'pending', null)
on conflict do nothing;
insert into public.order_items (order_id, product_id, product_name, quantity) values ('0d000000-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-0000000000b1', 'Grote friet', 2);
insert into public.customers (tenant_id, email) values ('22222222-2222-2222-2222-222222222222', 'jan@klant.test');
insert into public.invoices (tenant_id, total) values ('22222222-2222-2222-2222-222222222222', 12);
insert into public.kitchen_tickets (id, tenant_id, source, status) values
  ('7c000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'table', 'new'),
  ('7c000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'table', 'new') on conflict do nothing;
-- Twee kassa's in zaak B (de toestelaccount ziet enkel de zijne).
insert into public.pos_terminals (id, tenant_id, name) values ('5e000000-0000-0000-0000-0000000000b2', '22222222-2222-2222-2222-222222222222', 'Terras') on conflict do nothing;
insert into auth.users (id, email) values
  ('ac000000-0000-0000-0000-000000000001', 'kassa-1@toestel.sellqo.app'),
  ('ac000000-0000-0000-0000-000000000002', 'kassa-2@toestel.sellqo.app'),
  ('ac000000-0000-0000-0000-000000000003', 'kassa-3@toestel.sellqo.app') on conflict do nothing;

-- ── Koppelcode aanmaken: enkel tenant_admin van die zaak, enkel een eigen (niet-virtuele) kassa ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';  -- staff van A
select pg_temp.try($$select public.kassa_pair_code_create('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001')$$) = '42501' as ok_staff_cannot_create_code;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';  -- eigenaar B
select pg_temp.try($$select public.kassa_pair_code_create('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001')$$) = '42501' as ok_other_tenant_code_refused;
select pg_temp.try($$select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-000000000001')$$) = 'P0002' as ok_foreign_terminal_refused;
select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'Toog iPad') as pc \gset
select (:'pc'::jsonb ->> 'code') ~ '^[0-9]{6}$' and (:'pc'::jsonb ->> 'token') ~ '^[0-9a-f]{64}$'
   and (:'pc'::jsonb ->> 'expires_at')::timestamptz between now() + interval '9 minutes' and now() + interval '11 minutes' as ok_code_shape;
select :'pc'::jsonb ->> 'code' as code1, :'pc'::jsonb ->> 'token' as token1 \gset
-- Niet-toestel mag niet zelf inruilen.
select pg_temp.try(format('select public.kassa_pair_claim(%L, %L, %L)', :'code1', '1.1.1.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa')) = '42501' as ok_authenticated_cannot_claim;
select pg_temp.try($$select count(*) from public.kassa_pair_codes$$) = '42501' as ok_codes_not_readable;
reset role;
select (select count(*) = 0 from public.kassa_pair_codes where code_hash = :'code1' or token_hash = :'token1') as ok_code_not_stored_plain;
select (select count(*) = 1 from public.kassa_pair_codes where code_hash = encode(digest('kassa-pair|' || :'code1', 'sha256'), 'hex')) as ok_code_stored_hashed;
-- Een nieuwe code voor dezelfde kassa vervangt de open code.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'Toog iPad') as pc2 \gset
reset role;
select :'pc2'::jsonb ->> 'code' as code2, :'pc2'::jsonb ->> 'token' as token2 \gset
select (select count(*) = 1 from public.kassa_pair_codes where terminal_id = '5e000000-0000-0000-0000-0000000000b1' and used_at is null) as ok_new_code_replaces_old;

-- ── Inruilen (service role, zoals de edge function): rate limit, eenmalig, verlopen ──
set role service_role;
select public.kassa_pair_claim(:'code1', '10.0.0.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_replaced_code_invalid;
select public.kassa_pair_claim('abc', '10.0.0.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_garbage_invalid;
select public.kassa_pair_claim(lpad(((:'code2'::int + 1) % 1000000)::text, 6, '0'), '10.0.0.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_wrong_code_3;
select public.kassa_pair_claim(lpad(((:'code2'::int + 2) % 1000000)::text, 6, '0'), '10.0.0.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_wrong_code_4;
select public.kassa_pair_claim(lpad(((:'code2'::int + 3) % 1000000)::text, 6, '0'), '10.0.0.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_wrong_code_5;
-- Na 5 fouten: ook de JUISTE code wordt van dit IP geweigerd (en niet verbruikt).
select public.kassa_pair_claim(:'code2', '10.0.0.1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'rate_limited' as ok_ip_rate_limited;
reset role;
select (select used_at is null from public.kassa_pair_codes where code_hash = encode(digest('kassa-pair|' || :'code2', 'sha256'), 'hex')) as ok_rate_limit_does_not_consume;
select (select count(*) = 0 from public.kassa_pair_attempts where ip_hash = '10.0.0.1') as ok_ip_not_stored_plain;
set role service_role;
select public.kassa_pair_claim(:'code2', '10.0.0.2', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001') as claim1 \gset
select (:'claim1'::jsonb ->> 'ok')::boolean and :'claim1'::jsonb ->> 'tenant_id' = '22222222-2222-2222-2222-222222222222'
   and :'claim1'::jsonb ->> 'terminal_id' = '5e000000-0000-0000-0000-0000000000b1' and :'claim1'::jsonb ->> 'name' = 'Toog iPad' as ok_claim_by_code;
select :'claim1'::jsonb ->> 'code_id' as code_id1 \gset
-- Eenmalig: dezelfde code of het QR-token van dezelfde code nog eens = ongeldig.
select public.kassa_pair_claim(:'code2', '10.0.0.3', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_code_single_use;
select public.kassa_pair_claim(:'token2', '10.0.0.3', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_token_of_used_code_invalid;
-- Koppeling vastleggen; een tweede keer kan niet.
select public.kassa_pair_complete(:'code_id1', 'ac000000-0000-0000-0000-000000000001', 'AAAAAAAA-BBBB-4CCC-8DDD-000000000001', null) ->> 'ok' = 'true' as ok_complete;
select pg_temp.try(format('select public.kassa_pair_complete(%L, %L, %L, null)', :'code_id1', 'ac000000-0000-0000-0000-000000000002', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002')) = 'P0001' as ok_complete_once;
reset role;
select (select device_uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001' and name = 'Toog iPad' and paired_by = 'aaaaaaaa-0000-0000-0000-000000000002' and revoked_at is null
  from public.kassa_device_accounts where user_id = 'ac000000-0000-0000-0000-000000000001') as ok_account_row;

-- QR-token: werkt even goed; verlopen code werkt niet; vrijgeven na een mislukte aanmaak.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b2') as pc3 \gset
reset role;
select :'pc3'::jsonb ->> 'code' as code3, :'pc3'::jsonb ->> 'token' as token3 \gset
set role service_role;
select public.kassa_pair_claim(:'token3', '10.0.0.4', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') as claim3 \gset
select (:'claim3'::jsonb ->> 'ok')::boolean as ok_claim_by_token;
select public.kassa_pair_release((:'claim3'::jsonb ->> 'code_id')::uuid);
select (public.kassa_pair_claim(:'code3', '10.0.0.4', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'ok')::boolean as ok_released_code_claimable_again;
reset role;
update public.kassa_pair_codes set used_at = null, expires_at = now() - interval '1 second' where token_hash = encode(digest('kassa-pair|' || :'token3', 'sha256'), 'hex');
set role service_role;
select public.kassa_pair_claim(:'token3', '10.0.0.5', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_expired_invalid;
reset role;
-- Review 1 (3) + 2: platformbreed wordt NIEMAND geweigerd. Vanaf 50 fouten in 15 minuten (alle IP's samen)
-- worden de open 6-cijfercodes ongeldig; het QR-token blijft werken; een juiste code van een vers IP krijgt
-- "invalid", nooit "rate_limited"; platformbeheer (winkel 'sellqo') krijgt één melding per kwartier.
do $$ begin
  if to_regtype('public.notification_category') is null then create type public.notification_category as enum ('system', 'orders'); end if;
  if to_regtype('public.notification_priority') is null then create type public.notification_priority as enum ('low', 'medium', 'high', 'urgent'); end if;
end $$;
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), tenant_id uuid, category public.notification_category,
  type text, title text, message text, priority public.notification_priority, action_url text, data jsonb, created_at timestamptz default now());
insert into public.tenants (id, name, slug) values ('5e110000-0000-0000-0000-000000000001', 'SellQo', 'sellqo') on conflict do nothing;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b2') as pc5 \gset
reset role;
select :'pc5'::jsonb ->> 'code' as code5, :'pc5'::jsonb ->> 'token' as token5 \gset
-- Aanvullen tot 48 fouten in het venster; de 49e (hieronder) blijft onder de drempel.
insert into public.kassa_pair_attempts (ip_hash, ok)
  select 'x' || g, false from generate_series(1, 48 - (select count(*) from public.kassa_pair_attempts where not ok and created_at > now() - interval '15 minutes')) g;
set role service_role;
select public.kassa_pair_claim('000000', '10.0.0.97', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_global_49;
reset role;
select (select code_hash not like 'ongeldig:%' from public.kassa_pair_codes where token_hash = encode(digest('kassa-pair|' || :'token5', 'sha256'), 'hex')) as ok_global_below_50_code_valid;
set role service_role;
select public.kassa_pair_claim(lpad(((:'code5'::int + 7) % 1000000)::text, 6, '0'), '10.0.0.98', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_global_no_refusal;
select public.kassa_pair_claim(:'code5', '10.0.0.99', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid' as ok_global_codes_invalidated;
reset role;
select (select code_hash like 'ongeldig:%' and used_at is null from public.kassa_pair_codes where token_hash = encode(digest('kassa-pair|' || :'token5', 'sha256'), 'hex')) as ok_global_token_kept;
select (select count(*) = 1 from public.notifications where type = 'kassa_pair_bruteforce' and tenant_id = '5e110000-0000-0000-0000-000000000001'
          and category = 'system' and data ->> 'dedupe_key' like 'kassa_pair_bruteforce:%') as ok_global_one_notification_per_quarter;
set role service_role;
select (public.kassa_pair_claim(:'token5', '10.0.0.99', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'ok')::boolean as ok_global_token_still_works;
reset role;
select (select count(*) = 0 from public.kassa_pair_attempts a join (values ('10.0.0.98'), ('10.0.0.99')) v(ip) on a.ip_hash = v.ip) as ok_no_plain_ip;
delete from public.kassa_pair_attempts where ip_hash like 'x%' or not ok;
delete from public.kassa_pair_codes where token_hash = encode(digest('kassa-pair|' || :'token5', 'sha256'), 'hex');
-- Review 2: onbekend IP (null) = geen limiet per IP (geen gedeelde bucket); de fouten tellen wel globaal.
set role service_role;
select bool_and(public.kassa_pair_claim(lpad(g::text, 6, '0'), null, 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa') ->> 'reason' = 'invalid') as ok_unknown_ip_never_rate_limited
  from generate_series(1, 7) g;
reset role;
select (select count(*) = 7 from public.kassa_pair_attempts where ip_hash = 'onbekend' and not ok) as ok_unknown_ip_counts_globally;
delete from public.kassa_pair_attempts where ip_hash = 'onbekend';

-- ── Review 1 (2): een al actief gekoppeld toestel-ID wordt niet overgenomen ──
insert into public.kassa_device_accounts (user_id, tenant_id, terminal_id, device_uuid, name)
  values ('ac000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b2', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', 'Terras');
insert into public.device_tokens (user_id, tenant_id, token) values ('ac000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'tok-oud');
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b2') ->> 'code' as code4 \gset
set role service_role;
select public.kassa_pair_claim(:'code4', '10.0.0.6', 'AAAAAAAA-BBBB-4CCC-8DDD-000000000003') ->> 'reason' = 'device_already_paired' as ok_takeover_refused;
-- Ook een toestel-ID van een andere zaak (DEV1, zaak B) kan niet onder een andere code.
select public.kassa_pair_claim(:'code4', '10.0.0.6', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001') ->> 'reason' = 'device_already_paired' as ok_takeover_dev1_refused;
reset role;
select (select used_at is null from public.kassa_pair_codes where code_hash = encode(digest('kassa-pair|' || :'code4', 'sha256'), 'hex'))
   and (select revoked_at is null from public.kassa_device_accounts where user_id = 'ac000000-0000-0000-0000-000000000003')
   and (select count(*) = 1 from public.device_tokens where user_id = 'ac000000-0000-0000-0000-000000000003') as ok_takeover_changes_nothing;
-- Race: claim lukte nog, maar intussen werd het toestel-ID gekoppeld → complete weigert met KA409.
set role service_role;
select public.kassa_pair_claim(:'code4', '10.0.0.6', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000bb') ->> 'code_id' as code_id4 \gset
select pg_temp.try(format('select public.kassa_pair_complete(%L, %L, %L, null)', :'code_id4', 'ac000000-0000-0000-0000-000000000002', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003')) = 'KA409' as ok_complete_race_refused;
reset role;
-- Beheer ontkoppelt de oude koppeling; daarna kan het toestel-ID opnieuw gekoppeld worden.
update public.kassa_device_accounts set revoked_at = now() where user_id = 'ac000000-0000-0000-0000-000000000003';
set role service_role;
select public.kassa_pair_complete(:'code_id4', 'ac000000-0000-0000-0000-000000000002', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', 'Terras 2') ->> 'ok' = 'true' as ok_repair_after_unpair;
reset role;

-- ── Het toestel (DEV1: zaak B, kassa Toog, device aaaaaaaa-bbbb-4ccc-8ddd-000000000001) ──
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-000000000001';
set request.jwt.claims = '{"sub":"ac000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.kassa_device_tenant() = '22222222-2222-2222-2222-222222222222' as ok_device_tenant;
select public.kassa_device_context() as ctx \gset
select :'ctx'::jsonb -> 'tenant' ->> 'id' = '22222222-2222-2222-2222-222222222222' and :'ctx'::jsonb -> 'terminal' ->> 'id' = '5e000000-0000-0000-0000-0000000000b1'
   and :'ctx'::jsonb -> 'device' ->> 'device_uuid' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001' and :'ctx'::jsonb -> 'tenant' ->> 'iban' = 'BE68539007547034' as ok_context;
select not (:'ctx'::jsonb -> 'tenant' ? 'owner_email') and not (:'ctx'::jsonb -> 'tenant' ? 'stripe_account_id') as ok_context_narrow;

-- De kassa-RPC's: het toestel komt voorbij de toegangscontrole (eigen device_uuid).
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '[]')$$) = 'ok' as ok_dev_horeca_apply;
select pg_temp.try($$select public.horeca_snapshot('22222222-2222-2222-2222-222222222222')$$) = 'ok' as ok_dev_snapshot;
select pg_temp.try($$select public.kassa_heartbeat('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) = 'ok' as ok_dev_heartbeat;
select pg_temp.try($$select public.kassa_staff_login('99999999-0000-0000-0000-0000000000b2', '1234', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001')$$) = 'ok' as ok_dev_staff_login;
select pg_temp.try($$select public.kassa_my_shift('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2')$$) = 'ok' as ok_dev_my_shift;
select pg_temp.try($$select public.kassa_clock_state('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2')$$) = 'ok' as ok_dev_clock_state;
select pg_temp.try($$select public.kassa_report_due('22222222-2222-2222-2222-222222222222')$$) = 'ok' as ok_dev_report_due;
select pg_temp.try($$select public.kassa_staff_logout('22222222-2222-2222-2222-222222222222', 'x')$$) = 'ok' as ok_dev_staff_logout;
-- Overige RPC's: elke andere uitkomst dan 42501 = voorbij de toegangscontrole (de inhoud testen hun eigen suites).
select pg_temp.try($$select public.horeca_pay('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_pay;
select pg_temp.try($$select public.horeca_pay_begin('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_pay_begin;
select pg_temp.try($$select public.horeca_pay_release('22222222-2222-2222-2222-222222222222', gen_random_uuid(), gen_random_uuid())$$) <> '42501' as ok_dev_pay_release;
select pg_temp.try($$select public.kassa_approve('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_approve;
select pg_temp.try($$select public.kassa_product_quick_edit('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_quick_edit;
select pg_temp.try($$select public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_cash_move;
select pg_temp.try($$select public.kassa_shift('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_shift;
select pg_temp.try($$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_report_begin;
select pg_temp.try($$select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '{}')$$) <> '42501' as ok_dev_report_finish;
select pg_temp.try($$select public.kassa_report_source('22222222-2222-2222-2222-222222222222', gen_random_uuid(), 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001')$$) <> '42501' as ok_dev_report_source;
select pg_temp.try($$select public.kassa_report_release('22222222-2222-2222-2222-222222222222', gen_random_uuid())$$) <> '42501' as ok_dev_report_release;
select pg_temp.try($$select public.kassa_clock('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2', 'in', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '5e000000-0000-0000-0000-0000000000b1', null)$$) <> '42501' as ok_dev_clock;
-- (horeca_table_request_*, horeca_table_call_handle en horeca_notify_device_* bestaan niet in de lokale
--  testdatabank; de migratie patcht ze live met hetzelfde anker, nagetrokken op 2-11-2026.)

-- p_device_id-binding: een ander device-id (of geen) = 42501, ook in kassa_staff_login.
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'dev-b', '[]')$$) = '42501' as ok_dev_wrong_device_apply;
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', null, '[]')$$) = '42501' as ok_dev_null_device_apply;
select pg_temp.try($$select public.kassa_heartbeat('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', '{}')$$) = '42501' as ok_dev_other_device_heartbeat;
select pg_temp.try($$select public.kassa_staff_login('99999999-0000-0000-0000-0000000000b2', '1234', 'nep')$$) = '42501' as ok_dev_wrong_device_login;
select pg_temp.try($$select public.kassa_staff_login('99999999-0000-0000-0000-0000000000b2', '1234')$$) = '42501' as ok_dev_no_device_login;
-- Andere winkel: alles dicht.
select pg_temp.try($$select public.horeca_apply('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '[]')$$) = '42501' as ok_dev_other_tenant_apply;
select pg_temp.try($$select public.horeca_snapshot('11111111-1111-1111-1111-111111111111')$$) = '42501' as ok_dev_other_tenant_snapshot;
select pg_temp.try($$select public.kassa_report_due('11111111-1111-1111-1111-111111111111')$$) = '42501' as ok_dev_other_tenant_report;
select pg_temp.try($$select public.kassa_kitchen_orders('11111111-1111-1111-1111-111111111111')$$) = '42501' as ok_dev_other_tenant_kitchen;

-- Tabellen uit plan §1.2: lezen (eigen zaak), en de toegestane schrijfacties.
select pg_temp.rows($$select 1 from public.products$$) > 0 and pg_temp.rows($$select 1 from public.products where tenant_id <> '22222222-2222-2222-2222-222222222222'$$) = 0 as ok_dev_reads_own_products_only;
select pg_temp.rows($$select 1 from public.pos_terminals$$) = 1 and pg_temp.rows($$select 1 from public.pos_terminals where id = '5e000000-0000-0000-0000-0000000000b1'$$) = 1 as ok_dev_sees_own_terminal_only;
select pg_temp.rows($$select id from public.pos_cashiers$$) > 0 and pg_temp.rows($$select id from public.pos_cashiers where tenant_id <> '22222222-2222-2222-2222-222222222222'$$) = 0 as ok_dev_reads_cashiers;
select pg_temp.rows($$select 1 from public.check_lines$$) > 0 as ok_dev_reads_check_lines;
select pg_temp.rows($$select 1 from public.kitchen_tickets$$) = pg_temp.rows($$select 1 from public.kitchen_tickets where tenant_id = '22222222-2222-2222-2222-222222222222'$$)
   and pg_temp.rows($$select 1 from public.kitchen_tickets$$) > 0 as ok_dev_reads_own_tickets;
select pg_temp.affected($$update public.kitchen_tickets set status = 'preparing' where id = '7c000000-0000-0000-0000-0000000000b1'$$) = 1 as ok_dev_updates_ticket;
select pg_temp.affected($$update public.kitchen_tickets set status = 'preparing' where id = '7c000000-0000-0000-0000-0000000000a1'$$) = 0 as ok_dev_cannot_update_other_ticket;
select pg_temp.try($$insert into public.kitchen_tickets (tenant_id, source, order_id, status) values ('22222222-2222-2222-2222-222222222222', 'webshop', '0d000000-0000-0000-0000-0000000000b1', 'ready')$$) = 'ok' as ok_dev_inserts_ticket;
select pg_temp.try($$insert into public.kitchen_tickets (tenant_id, source, status) values ('11111111-1111-1111-1111-111111111111', 'table', 'new')$$) = '42501' as ok_dev_cannot_insert_other_ticket;
select pg_temp.try($$insert into public.fiscal_events (tenant_id, created_by, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time,
    pos_sw_version, booking_date, booking_period_id, fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter,
    request_body, response_body, request_sha256)
  values ('22222222-2222-2222-2222-222222222222', 'ac000000-0000-0000-0000-000000000001', 'signSale', 'CPOS0031234567', 'TER-B', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 1,
    '2026-11-02T13:00:00.000+01:00', '1', '2026-11-02', 'dffcd829-a0e5-41ca-a0ae-9eb887f95637', 'SIM01000001', '2026-11-02T12:00:08.000Z', 'N', 'SALE', 991, 991, '{}', '{}', repeat('a', 64))$$) = 'ok' as ok_dev_inserts_fiscal_event;
select pg_temp.try($$insert into public.fiscal_events (tenant_id, created_by, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time,
    pos_sw_version, booking_date, booking_period_id, fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter,
    request_body, response_body, request_sha256)
  values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'signSale', 'CPOS0031234567', 'TER-B', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 2,
    '2026-11-02T13:01:00.000+01:00', '1', '2026-11-02', 'dffcd829-a0e5-41ca-a0ae-9eb887f95637', 'SIM01000001', '2026-11-02T12:01:08.000Z', 'N', 'SALE', 992, 992, '{}', '{}', repeat('a', 64))$$) = '42501' as ok_dev_fiscal_event_not_as_other_user;
select pg_temp.rows($$select id from public.fiscal_events$$) > 0 and pg_temp.rows($$select id from public.fiscal_events where tenant_id <> '22222222-2222-2222-2222-222222222222'$$) = 0 as ok_dev_reads_own_fiscal_events;
select pg_temp.try($$insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details) values ('22222222-2222-2222-2222-222222222222', 'ac000000-0000-0000-0000-000000000001', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'drawer_open', '{}')$$) = 'ok' as ok_dev_writes_audit;
select pg_temp.try($$insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details) values ('11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000001', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', 'drawer_open', '{}')$$) = '42501' as ok_dev_no_audit_other_tenant;
-- Review 1 (1): device_id gebonden aan het eigen toestel (fiscal_audit_log en fiscal_events).
select pg_temp.try($$insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details) values ('22222222-2222-2222-2222-222222222222', 'ac000000-0000-0000-0000-000000000001', 'ander-toestel', 'drawer_open', '{}')$$) = '42501' as ok_dev_audit_other_device_refused;
select pg_temp.try($$insert into public.fiscal_audit_log (tenant_id, actor_id, action, details) values ('22222222-2222-2222-2222-222222222222', 'ac000000-0000-0000-0000-000000000001', 'drawer_open', '{}')$$) = '42501' as ok_dev_audit_no_device_refused;
select pg_temp.try($$insert into public.fiscal_events (tenant_id, created_by, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time,
    pos_sw_version, booking_date, booking_period_id, fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter,
    request_body, response_body, request_sha256)
  values ('22222222-2222-2222-2222-222222222222', 'ac000000-0000-0000-0000-000000000001', 'signSale', 'CPOS0031234567', 'TER-B', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', 3,
    '2026-11-02T13:02:00.000+01:00', '1', '2026-11-02', 'dffcd829-a0e5-41ca-a0ae-9eb887f95637', 'SIM01000001', '2026-11-02T12:02:08.000Z', 'N', 'SALE', 993, 993, '{}', '{}', repeat('a', 64))$$) = '42501' as ok_dev_fiscal_event_other_device_refused;
select pg_temp.rows($$select 1 from public.fiscal_audit_log$$) = 0 as ok_dev_cannot_read_audit;

-- Wat het toestel NIET mag: prijzen via REST, varianten, zaak, klanten, facturen, orders, rollen, beheer.
select pg_temp.affected($$update public.products set price = 0.01 where id = 'eeeeeeee-0000-0000-0000-0000000000b1'$$) = 0 as ok_dev_cannot_update_product_price;
select pg_temp.affected($$update public.product_variants set price = 0.01 where id = 'f0000000-0000-0000-0000-0000000000b1'$$) = 0 as ok_dev_cannot_update_variant_price;
select pg_temp.rows($$select 1 from public.tenants$$) = 0 as ok_dev_cannot_read_tenants;
select pg_temp.rows($$select 1 from public.customers$$) = 0 as ok_dev_cannot_read_customers;
select pg_temp.rows($$select 1 from public.invoices$$) = 0 as ok_dev_cannot_read_invoices;
select pg_temp.rows($$select 1 from public.orders$$) = 0 as ok_dev_cannot_read_orders;
select pg_temp.rows($$select 1 from public.user_roles$$) = 0 as ok_dev_has_no_roles;
select pg_temp.try($$insert into public.user_roles (user_id, role, tenant_id) values ('ac000000-0000-0000-0000-000000000001', 'tenant_admin', '22222222-2222-2222-2222-222222222222')$$) = '42501' as ok_dev_cannot_grant_itself_a_role;
select pg_temp.try($$select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1')$$) = '42501' as ok_dev_cannot_create_codes;
select pg_temp.rows($$select 1 from public.kassa_device_accounts$$) = 1 as ok_dev_sees_only_own_account;
select pg_temp.try($$update public.kassa_device_accounts set revoked_at = null$$) = '42501' as ok_dev_cannot_write_account;
-- Keukenbord: smalle lijst, zonder e-mail; adres enkel straat/nummer/postcode/gemeente.
select public.kassa_kitchen_orders('22222222-2222-2222-2222-222222222222') as ko \gset
select jsonb_array_length(:'ko'::jsonb) = 1 and :'ko'::jsonb -> 0 ->> 'order_number' = 'B-1' and not (:'ko'::jsonb -> 0 ? 'customer_email')
   and :'ko'::jsonb -> 0 -> 'shipping_address' = '{"street":"Kerkstraat","house_number":"1","postal_code":"3000","city":"Leuven"}'::jsonb
   and (:'ko'::jsonb -> 0 -> 'order_items' -> 0 ->> 'quantity')::int = 2 as ok_kitchen_orders_narrow;
reset role;
select (select price = 4.20 from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b1') and (select price = 5 from public.product_variants where id = 'f0000000-0000-0000-0000-0000000000b1') as ok_prices_untouched;

-- ── Overgang: de eigenaarsaccount werkt nog (tot KASSA-ACCOUNT-2), zonder binding; geen toestelcontext ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'dev-b', '[]')$$) = 'ok' as ok_owner_still_operates;
select public.kassa_device_context() is null and public.kassa_device_tenant() is null as ok_owner_is_no_device;
select pg_temp.rows($$select 1 from public.kassa_device_accounts$$) >= 2 as ok_owner_sees_devices;
select pg_temp.try($$select public.kassa_kitchen_orders('22222222-2222-2222-2222-222222222222')$$) = 'ok' as ok_owner_kitchen_orders;
-- Een kassa-account van een ANDERE zaak ziet de eigenaar van B niet.
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';  -- tenant_admin van A
select pg_temp.rows($$select 1 from public.kassa_device_accounts$$) = 0 as ok_other_admin_sees_no_devices;
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '[]')$$) = '42501' as ok_other_admin_refused;
-- Een account zonder lidmaatschap en zonder koppeling: horeca_snapshot blijft dicht (NULL-logica, review).
reset role; insert into auth.users (id, email) values ('ac000000-0000-0000-0000-0000000000ff', 'niemand@x.test') on conflict do nothing;
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000ff';
select pg_temp.try($$select public.horeca_snapshot('22222222-2222-2222-2222-222222222222')$$) = '42501' as ok_stranger_snapshot_refused;
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'x', '[]')$$) = '42501' as ok_stranger_apply_refused;
-- Review 1 (7): een toestelaccount kan geen winkel aanmaken (can_create_tenant), een gewone account wel.
reset role;
insert into public.profiles (id, email) values ('ac000000-0000-0000-0000-000000000001', 'kassa-1@toestel.sellqo.app'), ('ac000000-0000-0000-0000-0000000000ff', 'niemand@x.test') on conflict do nothing;
select public.can_create_tenant('ac000000-0000-0000-0000-000000000001', 'kassa-1@toestel.sellqo.app') = false as ok_device_cannot_create_tenant;
select public.can_create_tenant('ac000000-0000-0000-0000-0000000000ff', 'niemand@x.test') = true as ok_normal_user_can_create_tenant;
set request.jwt.claims = '{"sub":"ac000000-0000-0000-0000-0000000000ff","app_metadata":{"kind":"kassa"}}';
select public.can_create_tenant('ac000000-0000-0000-0000-0000000000ff', 'niemand@x.test') = false as ok_kassa_jwt_cannot_create_tenant;
set request.jwt.claims = '';
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000ff';
-- Anon: niets.
reset role; set role anon; set request.jwt.claim.sub = '';
select pg_temp.try($$select public.kassa_device_context()$$) = '42501' as ok_anon_no_context;
select pg_temp.try($$select public.kassa_pair_code_create('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1')$$) = '42501' as ok_anon_no_code;
reset role;

-- ── PRIJS-GATEN-2 × toestel: verkopen boekt voorraad af, manueel bijstellen niet ──
reset role;
update public.products set track_inventory = true, stock = 10 where id = 'eeeeeeee-0000-0000-0000-0000000000b1';
-- Het echte kassapad: horeca_pay (security definer) voegt een pos_transaction in → trigger
-- handle_pos_transaction_stock → decrement_stock → record_stock_movement('sale'), met auth.uid() = het toestel.
set request.jwt.claim.sub = 'ac000000-0000-0000-0000-000000000001';
select pg_temp.try($$insert into public.pos_transactions (tenant_id, terminal_id, cashier_id, status, items) values ('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'ac000000-0000-0000-0000-000000000001', 'completed', '[{"product_id":"eeeeeeee-0000-0000-0000-0000000000b1","quantity":2}]')$$) = 'ok' as ok_device_sale_trigger_ok;
set request.jwt.claim.sub = '';
select (select stock = 8 from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b1') as ok_device_sale_stock_down;
select (select count(*) = 1 from public.stock_movements where product_id = 'eeeeeeee-0000-0000-0000-0000000000b1' and reason = 'sale' and delta = -2 and created_by = 'ac000000-0000-0000-0000-000000000001') as ok_device_sale_movement;
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-000000000001';
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, -1, 'sale')$$) = 'ok' as ok_device_rsm_sale_ok;
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, 1, 'return')$$) = 'ok' as ok_device_rsm_return_ok;
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, 50, 'manual')$$) = '42501' as ok_device_manual_refused;
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, 50, 'adjustment')$$) = '42501' as ok_device_adjustment_refused;
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, 50, 'opening')$$) = '42501' as ok_device_opening_refused;
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, 50, 'purchase')$$) = '42501' as ok_device_purchase_refused;
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-0000000000b1', null, 50, null)$$) = '42501' as ok_device_null_reason_refused;
-- Ander winkel: ook 'sale' dicht.
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-000000000001', null, -1, 'sale')$$) <> 'ok' as ok_device_other_tenant_sale_refused;
select pg_temp.try($$select public.bulk_adjust_stock(array['eeeeeeee-0000-0000-0000-0000000000b1']::uuid[], 'set', 99)$$) <> 'ok' as ok_device_bulk_adjust_refused;
reset role;
select (select stock = 8 from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b1') as ok_device_stock_only_sale_return;
-- Een gewone account zonder rol (viewer van A) blijft dicht, ook voor 'sale' (PRIJS-GATEN-2 ongewijzigd).
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select pg_temp.try($$select public.record_stock_movement(null, 'eeeeeeee-0000-0000-0000-000000000001', null, -1, 'sale')$$) = '42501' as ok_viewer_sale_still_refused;
reset role;

-- ── Ontkoppelen werkt meteen (beheer: revoked_at; de edge function bant daarna de user) ──
update public.kassa_device_accounts set revoked_at = now() where user_id = 'ac000000-0000-0000-0000-000000000001';
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-000000000001';
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001', '[]')$$) = '42501' as ok_revoked_apply_refused;
select pg_temp.try($$select public.horeca_snapshot('22222222-2222-2222-2222-222222222222')$$) = '42501' as ok_revoked_snapshot_refused;
select pg_temp.try($$select public.kassa_staff_login('99999999-0000-0000-0000-0000000000b2', '1234', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001')$$) = '42501' as ok_revoked_login_refused;
select pg_temp.rows($$select 1 from public.products$$) = 0 and pg_temp.rows($$select 1 from public.kitchen_tickets$$) = 0 as ok_revoked_reads_nothing;
select public.kassa_device_context() is null as ok_revoked_no_context;
reset role;

-- ── Het toestel ontkoppelt zichzelf ──
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-000000000002';
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', '[]')$$) = 'ok' as ok_dev2_operates;
select public.kassa_device_unpair_self() as ok_unpair_self;
select pg_temp.try($$select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003', '[]')$$) = '42501' as ok_unpaired_refused;
select public.kassa_device_unpair_self() = false as ok_unpair_self_idempotent;
reset role;

\echo 'KASSA-ACCOUNT-1: alle tests geslaagd'

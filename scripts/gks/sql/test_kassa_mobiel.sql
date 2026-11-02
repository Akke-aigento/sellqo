\set ON_ERROR_STOP 1
-- KASSA-MOBIEL-1 — pushtoken overzetten (device_token_claim) en push naar gekoppelde kassatoestellen
-- (horeca_notify_targets / horeca_notify_devices_list). Draait na test_kassa_account.sql. De opzet (device_tokens zoals
-- live, horeca_notify_devices en de twee functies van vóór de patch) doet run.sh met 08_kassa_mobiel_prelude.sql;
-- daarna de migraties (2×) en dit bestand.
-- Spelers: A = aaaaaaaa-…0002 (eigenaar zaak B), P = aaaaaaaa-…0005 (andere zaak, "platform-account" op dezelfde
-- browser), toestel T = kassatoestel ac…0099 van zaak B (actief), toestel X = ac…0003 (ingetrokken in de vorige test).
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;

reset role;
delete from public.device_tokens;
delete from public.horeca_notify_devices;
insert into auth.users (id, email) values ('ac000000-0000-0000-0000-000000000099', 'kassa-t@toestel.sellqo.app') on conflict do nothing;
insert into public.kassa_device_accounts (user_id, tenant_id, terminal_id, device_uuid, name)
values ('ac000000-0000-0000-0000-000000000099', '22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1',
        '99999999-9999-4999-8999-999999999999', 'Toog iPad')
on conflict (user_id) do update set revoked_at = null;
-- Het web-abonnement van deze browser staat sinds vroeger op P (zoals live be6f2a43-… sinds 15-10).
insert into public.device_tokens (user_id, token, platform, os, p256dh, auth, install_id)
values ('aaaaaaaa-0000-0000-0000-000000000005', 'https://web.push.apple.com/abc', 'web', 'ios', 'P256', 'AUTH', 'inst-1');
-- Een native token van P.
insert into public.device_tokens (user_id, token, platform, os, install_id)
values ('aaaaaaaa-0000-0000-0000-000000000005', 'fcm-xyz', 'ios', 'ios', 'inst-2');

-- ── 1. De oorzaak: de oude upsert als A loopt vast op RLS (42501) ──────────────────────────────────────────
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.try($q$insert into public.device_tokens (user_id, token, platform, os, p256dh, auth)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'https://web.push.apple.com/abc', 'web', 'ios', 'P256', 'AUTH')
  on conflict (token) do update set user_id = excluded.user_id, last_seen_at = now()$q$) like '42501%' as ok_oude_upsert_42501;

-- ── 2. device_token_claim ─────────────────────────────────────────────────────────────────────────────
-- Andere sleutels = geen bewijs → geweigerd, niets veranderd.
select pg_temp.try($q$select public.device_token_claim('https://web.push.apple.com/abc', 'web', 'ios', 'iPhone', 'inst-1', 'ANDER', 'AUTH')$q$) like '42501%token_owned_elsewhere%' as ok_web_zonder_bewijs_geweigerd;
-- Platform anders dan de rij = geweigerd.
select pg_temp.try($q$select public.device_token_claim('fcm-xyz', 'android', 'android', 'x', 'inst-2', null, null)$q$) like '42501%' as ok_ander_platform_geweigerd;
-- Web zonder sleutels = ongeldig.
select pg_temp.try($q$select public.device_token_claim('https://nieuw', 'web', 'ios', 'iPhone', 'inst-1', null, null)$q$) like '22023%' as ok_web_zonder_sleutels;
select pg_temp.try($q$select public.device_token_claim('', 'ios', 'ios', 'x', null, null, null)$q$) like '22023%' as ok_leeg_token;
reset role;
select (select user_id from public.device_tokens where token = 'https://web.push.apple.com/abc') = 'aaaaaaaa-0000-0000-0000-000000000005' as ok_niets_veranderd;

-- Juiste sleutels = overgezet naar A.
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
select public.device_token_claim('https://web.push.apple.com/abc', 'web', 'ios', 'iPhone', 'inst-1', 'P256', 'AUTH') ->> 'status' = 'transferred' as ok_web_overgezet;
-- Native: het token zelf is het bewijs.
select public.device_token_claim('fcm-xyz', 'ios', 'ios', 'ios device', 'inst-2', null, null) ->> 'status' = 'transferred' as ok_native_overgezet;
-- Opnieuw = bijwerken; nieuw token = aanmaken.
select public.device_token_claim('fcm-xyz', 'ios', 'ios', 'ios device', 'inst-2', null, null) ->> 'status' = 'updated' as ok_eigen_bijgewerkt;
select public.device_token_claim('fcm-nieuw', 'android', 'android', 'Android', 'inst-3', null, null) ->> 'status' = 'created' as ok_nieuw_aangemaakt;
select count(*) = 3 from public.device_tokens as ok_a_ziet_drie;
reset role;
select (select count(*) from public.device_tokens where user_id = 'aaaaaaaa-0000-0000-0000-000000000002') = 3
   and (select count(*) from public.device_tokens where user_id = 'aaaaaaaa-0000-0000-0000-000000000005') = 0
   and (select count(*) from public.device_tokens) = 3 as ok_enkel_eigen_rijen_geraakt;
-- Anoniem: geweigerd.
set role anon;
select pg_temp.try($q$select public.device_token_claim('fcm-anon', 'ios', 'ios', 'x', null, null, null)$q$) like '42501%' as ok_anon_geweigerd;
reset role;

-- ── 3. Toestel T schrijft zich in de kassa in (eigen web-abonnement, scope /kassa/) ────────────────────────
set role authenticated;
select pg_temp.as_user('ac000000-0000-0000-0000-000000000099');
select public.device_token_claim('https://web.push.apple.com/kassa', 'web', 'ios', 'iPad', 'inst-1', 'K256', 'KAUTH') ->> 'status' = 'created' as ok_toestel_ingeschreven;
reset role;
insert into public.horeca_notify_devices (tenant_id, install_id, name, kind, events, station_ids, personal, lang)
values ('22222222-2222-2222-2222-222222222222', 'inst-1', 'Toog', 'kassa', '{qr_request}', '{}', false, 'nl');

-- ── 4. horeca_notify_targets: toestel T krijgt de melding; ingetrokken toestel niet ─────────────────────────
select exists (select 1 from public.horeca_notify_targets('22222222-2222-2222-2222-222222222222', 'qr_request', null) t
                where t.token = 'https://web.push.apple.com/kassa') as ok_toestel_krijgt_melding;
select exists (select 1 from public.horeca_notify_targets('22222222-2222-2222-2222-222222222222', 'qr_request', null) t
                where t.token = 'https://web.push.apple.com/abc') as ok_eigenaar_krijgt_melding;
update public.kassa_device_accounts set revoked_at = now() where user_id = 'ac000000-0000-0000-0000-000000000099';
select not exists (select 1 from public.horeca_notify_targets('22222222-2222-2222-2222-222222222222', 'qr_request', null) t
                    where t.token = 'https://web.push.apple.com/kassa') as ok_ingetrokken_krijgt_niets;
-- Andere zaak: niets.
select not exists (select 1 from public.horeca_notify_targets('11111111-1111-1111-1111-111111111111', 'qr_request', null)) as ok_andere_zaak_niets;
update public.kassa_device_accounts set revoked_at = null where user_id = 'ac000000-0000-0000-0000-000000000099';

-- ── 5. horeca_notify_devices_list: push-bolletje voor het toestel ────────────────────────────────────────
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
select (public.horeca_notify_devices_list('22222222-2222-2222-2222-222222222222') -> 0 ->> 'push')::boolean as ok_lijst_toont_push;
reset role;

-- ── 6. Idempotent: precies één marker per functie ───────────────────────────────────────────────────────
select (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
          and p.proname in ('horeca_notify_targets', 'horeca_notify_devices_list')
          and (length(pg_get_functiondef(p.oid)) - length(replace(pg_get_functiondef(p.oid), 'KASSA-MOBIEL-1', ''))) / length('KASSA-MOBIEL-1') = 1) = 2
  as ok_een_marker_per_functie;

delete from public.device_tokens;
delete from public.horeca_notify_devices;
\echo 'KASSA-MOBIEL-1: alle tests geslaagd'

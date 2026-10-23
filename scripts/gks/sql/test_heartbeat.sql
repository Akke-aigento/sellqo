\set ON_ERROR_STOP 1
-- LIVE-1 — toestelhartslag. Draait na test_pay.sql (terminals 5e…001 van zaak A, 5e…003 van C).
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.kassa_heartbeat('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001', 'dev-1',
  '{"sw_version":"sellqo-kassa-0.4.0","fiscal_mode":"off","queue_count":3,"outbox_count":0,"pending_pays":1,"last_sync_at":"2026-10-24T12:00:00Z","online":false,"user_agent":"test"}');
select public.kassa_heartbeat('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001', 'dev-1', '{"queue_count":-5,"fiscal_mode":"hack"}');
select count(*) = 1 as ok_one_row from public.kassa_devices;
select queue_count = 0 and fiscal_mode is null and online as ok_clamped_and_updated from public.kassa_devices where device_id = 'dev-1';
-- terminal van een andere zaak: geweigerd
do $$ begin perform public.kassa_heartbeat('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000003', 'dev-x', '{}'); raise exception 'FOUT: vreemde terminal'; exception when sqlstate '22023' then null; end $$;
-- rechtstreeks schrijven kan niet
do $$ begin update public.kassa_devices set queue_count = 9; raise exception 'FOUT: update'; exception when insufficient_privilege then null; end $$;
reset role;
select last_seen_at is not null as ok_terminal_seen from public.pos_terminals where id = '5e000000-0000-0000-0000-000000000001';
-- vreemde zaak ziet niets, viewer leest wel, anon niets
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
select count(*) = 0 as ok_foreign_sees_nothing from public.kassa_devices;
do $$ begin perform public.kassa_heartbeat('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001', 'dev-2', '{}'); raise exception 'FOUT: vreemde zaak'; exception when insufficient_privilege then null; end $$;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select count(*) = 1 as ok_viewer_reads from public.kassa_devices;
reset role; set role anon;
do $$ begin perform public.kassa_heartbeat('11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001', 'dev-3', '{}'); raise exception 'FOUT: anon'; exception when insufficient_privilege then null; end $$;
reset role;
\echo 'LIVE-1 hartslag: alle tests geslaagd'

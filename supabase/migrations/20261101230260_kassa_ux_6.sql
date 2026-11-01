-- KASSA-UX-6 — kassa-ergonomie (rollenwandeling 1-11): drie serverstukjes.
--
-- 1. horeca_pay_settings.kassa_lock_minutes: na hoeveel minuten zonder aanraking de kassa op het
--    PIN-scherm valt (0 = nooit). Standaard 2, zoals de vaste waarde tot nu (session.tsx).
--    Instelbaar in Kassa › Personeel (beheer, /admin/pos). horeca_pay_settings is een horecatabel (niet gedeeld met custom
--    frontends); strikt additief, nieuwe kolom met default.
-- 2. kassa_my_shift(): "Mijn dienst" voor de aangemelde medewerker — aantal afrekeningen, omzet en
--    fooi van de lopende bedrijfsdag, uit dezelfde bron als het X-rapport (kassa_report_data → staff).
--    Leest enkel; maakt geen rapport en geen fiscaal event (RPT ongewijzigd).
-- 3. kassa_counter_guard: een lopende toogverkoop mag naar een rekening op naam of een vrije tafel
--    (move_check) of bij een bestaande rekening (move_lines, alles). Aan de toog bestaan enkel
--    ontwerp-lijnen (niets ging naar FDM of keuken), dus geen fiscaal event: de lijnen gaan als
--    gewone ronde mee wanneer de rekening verstuurd wordt. Het btw-tarief wordt eerst dat van
--    ter plaatse (zoals set_service eat_in), want een rekening aan tafel is ter plaatse.
--    Aanpak: pg_get_functiondef + replace met unieke ankers (zoals KASSA-UX-4); idempotent.
--
-- Handmatig terugdraaien (laat andere patches staan; NIET de snapshot terugzetten):
--   do $r$ declare d text := pg_get_functiondef('public.kassa_counter_guard(uuid, jsonb)'::regprocedure); b text; begin
--     b := substring(d from E'(  -- KASSA-UX-6: de toogverkoop wordt.*?  end if;\n\n)');
--     d := replace(d, b, '');
--     execute replace(d, E', ''move_check'', ''move_lines'') then', ') then');
--   end $r$;   -- daarna: position('KASSA-UX-6' in pg_get_functiondef(...)) = 0
--   (de definitie van vóór deze migratie staat ter controle in snapshots.sellqo_20261101_fn_kassa_ux_6)
--   drop function if exists public.kassa_my_shift(uuid, uuid);
--   alter table public.horeca_pay_settings drop column if exists kassa_lock_minutes;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261101_fn_kassa_ux_6 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as md5, now() as taken_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'kassa_counter_guard';
revoke all on snapshots.sellqo_20261101_fn_kassa_ux_6 from anon, authenticated;

-- 1. Vergrendeltijd ----------------------------------------------------------------------------
alter table public.horeca_pay_settings add column if not exists kassa_lock_minutes integer not null default 2;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.horeca_pay_settings'::regclass and conname = 'horeca_pay_settings_lock_minutes_check') then
    alter table public.horeca_pay_settings add constraint horeca_pay_settings_lock_minutes_check check (kassa_lock_minutes in (0, 1, 2, 5, 10));
  end if;
end
$mig$;
comment on column public.horeca_pay_settings.kassa_lock_minutes is 'KASSA-UX-6: minuten zonder aanraking tot het PIN-scherm (0 = nooit).';

-- 2. Mijn dienst -------------------------------------------------------------------------------
create or replace function public.kassa_my_shift(p_tenant_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_day date;
  v_from timestamptz;
  v_to timestamptz;
  v_data jsonb;
  s jsonb;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pos_cashiers x where x.id = p_staff_id and x.tenant_id = p_tenant_id) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  v_day := public.kassa_business_day(p_tenant_id, now());
  v_from := public.kassa_day_start(p_tenant_id, v_day);
  v_to := least(public.kassa_day_start(p_tenant_id, v_day + 1), now());
  v_data := public.kassa_report_data(p_tenant_id, v_from, v_to);
  select e into s from jsonb_array_elements(coalesce(v_data -> 'staff', '[]'::jsonb)) e where e ->> 'staff_id' = p_staff_id::text limit 1;
  return jsonb_build_object('booking_date', v_day, 'from', v_from, 'to', v_to,
    'count', coalesce((s ->> 'count')::bigint, 0), 'total_cents', coalesce((s ->> 'total_cents')::bigint, 0),
    'tips_cents', coalesce((s ->> 'tips_cents')::bigint, 0));
end;
$$;
revoke all on function public.kassa_my_shift(uuid, uuid) from public, anon;
grant execute on function public.kassa_my_shift(uuid, uuid) to authenticated;

-- 3. Toogverkoop naar een rekening op naam / tafel ---------------------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.kassa_counter_guard(uuid, jsonb)'::regprocedure);
  a_list text := E'''rename_check'', ''void_check'', ''set_service'') then';
  a_svc text := E'  if v_kind = ''set_service'' then\n    if coalesce';
  branch text := E'  -- KASSA-UX-6: de toogverkoop wordt een gewone rekening (op naam/tafel) of gaat bij een bestaande.\n'
              || E'  -- Enkel ontwerp-lijnen (aan de toog gaat niets vooraf naar FDM/keuken): geen fiscaal event.\n'
              || E'  if v_kind in (''move_check'', ''move_lines'') then\n'
              || E'    if exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = ''sent'') then\n'
              || E'      raise exception ''deze toogverkoop kan niet meer verplaatst worden'' using errcode = ''55000'';\n'
              || E'    end if;\n'
              || E'    if v_kind = ''move_lines'' and coalesce((cmd ->> ''split'')::boolean, false) then\n'
              || E'      raise exception ''een toogverkoop splits je niet: reken ze af of zet ze op naam'' using errcode = ''22023'';\n'
              || E'    end if;\n'
              || E'    if v_kind = ''move_lines'' and exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = ''draft'' and x.qty > 0\n'
              || E'         and x.id::text not in (select m ->> ''line_id'' from jsonb_array_elements(coalesce(cmd -> ''moves'', ''[]''::jsonb)) m)) then\n'
              || E'      raise exception ''een toogverkoop verplaats je volledig'' using errcode = ''22023'';\n'
              || E'    end if;\n'
              || E'    -- Aan tafel = ter plaatse: het tarief van de open lijnen volgt (zoals set_service eat_in).\n'
              || E'    if c.service = ''takeaway'' then\n'
              || E'      for l in select x.id, x.product_id from public.check_lines x where x.check_id = c.id and x.state = ''draft'' and x.product_id is not null for update loop\n'
              || E'        v_rate := public.kassa_product_vat_rate(p_tenant_id, l.product_id, false);\n'
              || E'        v_label := public.horeca_vat_label(v_rate);\n'
              || E'        if v_label is null then raise exception ''btw-tarief % past niet op een Belgisch label'', v_rate using errcode = ''22023''; end if;\n'
              || E'        update public.check_lines set vat_rate = v_rate, vat_label = v_label where id = l.id;\n'
              || E'      end loop;\n'
              || E'    end if;\n'
              || E'    if v_kind = ''move_check'' then\n'
              || E'      update public.dining_checks set kind = ''table'', service = null where id = c.id;\n'
              || E'    else\n'
              || E'      update public.dining_checks set service = ''eat_in'' where id = c.id and service is distinct from ''eat_in'';\n'
              || E'    end if;\n'
              || E'    return null; -- horeca_apply_one doet de verplaatsing zelf\n'
              || E'  end if;\n\n';
begin
  if position('KASSA-UX-6' in d) > 0 then
    raise notice 'KASSA-UX-6: kassa_counter_guard al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, a_list, ''))) / length(a_list) <> 1 then
    raise exception 'KASSA-UX-6: anker lijst niet precies één keer gevonden in kassa_counter_guard';
  end if;
  if (length(d) - length(replace(d, a_svc, ''))) / length(a_svc) <> 1 then
    raise exception 'KASSA-UX-6: anker set_service niet precies één keer gevonden in kassa_counter_guard';
  end if;
  d := replace(d, a_list, E'''rename_check'', ''void_check'', ''set_service'', ''move_check'', ''move_lines'') then');
  execute replace(d, a_svc, branch || a_svc);
end
$patch$;

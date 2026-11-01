-- GANGEN-1 — gangen (voorgerecht, hoofdgerecht, dessert) aan tafel, met "gang vrijgeven".
--
-- Ontwerp (zie docs/nachtrun/GANGEN-1.md): geen nieuw fiscaal event. Een lijn van een latere gang
-- blijft een ONTWERP-lijn (niet verstuurd, geen P/ORDER) tot de bediening de gang vrijgeeft; vrijgeven =
-- dining_checks.course_fired ophogen (niet fiscaal, zoals rename_check/cancel_bill) en daarna die lijnen
-- als een gewone ronde versturen (send_round = P/ORDER, zoals altijd). De keuken ziet op de bon van de
-- huidige ronde ter info welke lijnen nog wachten ('waiting': true in items; geen bestelling).
--
-- 1. horeca_pay_settings.courses_enabled (standaard UIT: cafés merken niets) en course_by_category
--    ({categorie-id: 0..3}, 0 = geen gang). Instelbaar in Bestellen › Posten.
-- 2. dining_checks.course_fired: hoogste vrijgegeven gang van de rekening (null = nog niets vrijgegeven;
--    de kassa geeft dan de laagste gang op de rekening vrij).
-- 3. horeca_check_json: course_fired erbij (anker op 'version').
-- 4. horeca_apply_one: nieuw commando fire_course (anker vóór rename_check), en send_round zet de
--    wachtende ontwerp-lijnen van dezelfde post als 'waiting' op de bon (enkel als gangen aan staan).
--
-- Additief (nieuwe kolommen met default/null, nieuwe tak). Functies via pg_get_functiondef + replace,
-- elk anker precies 1× (live nagetrokken op 1-11-2026), idempotent via de marker 'GANGEN-1'.
-- Volgt na 20261101230200 (KEUKEN-VEILIG-1): het anker in send_round bevat de komma die die migratie
-- toevoegt; zonder die migratie breekt deze af in plaats van half te patchen.
--
-- Handmatig terugdraaien:
--   select name, def from ops.gangen_1_prev_functions;  -- en die definities opnieuw uitvoeren
--   alter table public.dining_checks drop column if exists course_fired;
--   alter table public.horeca_pay_settings drop column if exists courses_enabled, drop column if exists course_by_category;

create schema if not exists ops;
create table if not exists ops.gangen_1_prev_functions as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, now() as saved_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('horeca_apply_one', 'horeca_check_json');
revoke all on ops.gangen_1_prev_functions from anon, authenticated;

-- 1. Instellingen -------------------------------------------------------------------------------
alter table public.horeca_pay_settings add column if not exists courses_enabled boolean not null default false;
alter table public.horeca_pay_settings add column if not exists course_by_category jsonb not null default '{}'::jsonb;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.horeca_pay_settings'::regclass and conname = 'horeca_pay_settings_course_by_category_check') then
    alter table public.horeca_pay_settings add constraint horeca_pay_settings_course_by_category_check
      check (jsonb_typeof(course_by_category) = 'object' and octet_length(course_by_category::text) <= 20000);
  end if;
end
$mig$;
comment on column public.horeca_pay_settings.courses_enabled is 'GANGEN-1: gangen aan tafel (voor/hoofd/dessert, vrijgeven). Standaard uit.';
comment on column public.horeca_pay_settings.course_by_category is 'GANGEN-1: standaardgang per categorie {categorie-id: 0..3}; 0 = geen gang. Niet ingesteld: bar = geen gang, rest = hoofdgerecht.';

-- 2. Vrijgegeven gang per rekening ---------------------------------------------------------------
alter table public.dining_checks add column if not exists course_fired integer;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.dining_checks'::regclass and conname = 'dining_checks_course_fired_check') then
    alter table public.dining_checks add constraint dining_checks_course_fired_check check (course_fired is null or course_fired between 1 and 9);
  end if;
end
$mig$;
comment on column public.dining_checks.course_fired is 'GANGEN-1: hoogste vrijgegeven gang (null = nog geen). Niet fiscaal.';

-- 3. horeca_check_json ----------------------------------------------------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_check_json(uuid)'::regprocedure);
  anchor text := $a$'version', c.version, 'next_grouping_id', c.next_grouping_id,$a$;
begin
  if position('course_fired' in d) > 0 then
    raise notice 'GANGEN-1: horeca_check_json al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'GANGEN-1: anker version niet precies één keer gevonden in horeca_check_json';
  end if;
  execute replace(d, anchor, anchor || $a$ 'course_fired', c.course_fired,$a$);
end
$patch$;

-- 4. horeca_apply_one -----------------------------------------------------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure);
  pairs text[] := array[
    -- 4a. fire_course: gang vrijgeven (niet fiscaal; de lijnen gaan daarna als gewone ronde)
    $a$  elsif v_kind = 'rename_check' then$a$,
    $a$  elsif v_kind = 'fire_course' then
    -- GANGEN-1: gang vrijgeven. Enkel de stand van de rekening; het versturen is een gewone ronde.
    if nullif(cmd ->> 'course', '') is null or (cmd ->> 'course')::integer not between 1 and 9 then
      raise exception 'gang ongeldig' using errcode = '22023';
    end if;
    update public.dining_checks set course_fired = greatest(coalesce(course_fired, 0), (cmd ->> 'course')::integer),
      version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'rename_check' then$a$,
    -- 4b. send_round: wachtende lijnen van dezelfde post ter info op de bon
    $a$        order by x.course nulls first, x.seq),
      false, 'new',$a$,
    $a$        order by x.course nulls first, x.seq)
      -- GANGEN-1: wat nog wacht op vrijgave (ontwerp, niet besteld), ter info en apart op de bon.
      || coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'quantity', w.qty, 'note', w.note, 'course', w.course,
             'allergens', public.horeca_line_allergens(w.product_id, w.addons), 'waiting', true,
             'addons', (select coalesce(jsonb_agg(jsonb_build_object('name', a ->> 'name')), '[]'::jsonb) from jsonb_array_elements(w.addons) a))
             order by w.course, w.seq)
           from public.check_lines w
          where w.check_id = c.id and w.state = 'draft' and w.qty > 0 and w.course is not null and not (w.id = any(v_ids))
            and w.station_id is not distinct from x.station_id
            and exists (select 1 from public.horeca_pay_settings s where s.tenant_id = p_tenant_id and s.courses_enabled)), '[]'::jsonb),
      false, 'new',$a$
  ];
  i integer;
begin
  if position('GANGEN-1' in d) > 0 then
    raise notice 'GANGEN-1: horeca_apply_one al gepatcht';
    return;
  end if;
  for i in 1 .. array_length(pairs, 1) / 2 loop
    if (length(d) - length(replace(d, pairs[2 * i - 1], ''))) / length(pairs[2 * i - 1]) <> 1 then
      raise exception 'GANGEN-1: anker % niet precies één keer gevonden in horeca_apply_one', i;
    end if;
    d := replace(d, pairs[2 * i - 1], pairs[2 * i]);
  end loop;
  execute d;
end
$patch$;

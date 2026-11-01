-- KEUKEN-VEILIG-1 — wat de keuken en de bar moeten weten, staat op elke bon.
--
-- Recon (rollenwandeling 1-11-2026, nagetrokken in de code en op de live functiedefinities):
--   1. horeca_table_request_accept zet de algemene opmerking van een QR-gast ("allergie noten") enkel
--      op de EERSTE lijn van de aanvraag. Hoort die lijn bij de bar, dan ziet de keuken de allergie nooit.
--   2. Productallergenen (products.allergens, product_addon_options.allergens) staan nergens op een bon.
--   3. set_note wist de gang (course) van een lijn: `course = nullif(cmd ->> 'course', '')::integer`,
--      terwijl de kassa bij een opmerking nooit een course meestuurt.
--
-- Wat deze migratie doet (additief, geen kolommen of tabellen gewijzigd):
--   a. Nieuwe hulpfunctie public.horeca_line_allergens(product_id, addons): de EU-codes van het product
--      en van de gekozen extra's, als gesorteerde jsonb-array zonder dubbels.
--   b. horeca_apply_one / send_round: elke keukenbon van de ronde krijgt in kitchen_tickets.note de
--      algemene opmerking van de QR-aanvraag(en) waar de lijnen van komen (exact dezelfde tekst als op
--      lijn 1, zodat het keukenscherm de dubbele kan weglaten). Elke regel in items krijgt 'allergens'.
--   c. horeca_pay (toog-bonnen): elke regel in items krijgt 'allergens'.
--   d. horeca_apply_one / set_note: de gang blijft staan als het commando geen 'course' meestuurt.
--
-- Aanpak: zoals KASSA-UX-4 — pg_get_functiondef + replace, elk anker precies één keer, zodat wat sinds de
-- laatste migratie live aan de functies veranderde behouden blijft. Idempotent: bevat een functie al
-- 'KEUKEN-VEILIG-1', dan gebeurt er niets. Een anker dat niet (of meer dan één keer) gevonden wordt,
-- breekt de migratie af: er wordt nooit half gepatcht.
-- Ankers nagetrokken op de live DB (1-11-2026, read-only): elk precies 1×.
--
-- Raakt geen fiscale events of FDM-berichten (send_round ondertekent niets; de bon is geen fiscaal document).
-- Raakt storefront-api / storefront-customer-api niet.
--
-- Handmatig terugdraaien:
--   select def from ops.keuken_veilig_1_prev_functions where name in ('horeca_apply_one', 'horeca_pay');
--   en die definities opnieuw uitvoeren; daarna
--   drop function if exists public.horeca_line_allergens(uuid, jsonb);

create schema if not exists ops;
create table if not exists ops.keuken_veilig_1_prev_functions as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, now() as saved_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('horeca_apply_one', 'horeca_pay');

-- a. Allergenen van een kassalijn ------------------------------------------------------------------
create or replace function public.horeca_line_allergens(p_product_id uuid, p_addons jsonb)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select coalesce(jsonb_agg(s.a order by s.a), '[]'::jsonb)
  from (
    select unnest(p.allergens) as a from public.products p where p.id = p_product_id
    union
    select unnest(o.allergens) from public.product_addon_options o
     where o.id in (select (e ->> 'option_id')::uuid
                      from jsonb_array_elements(case when jsonb_typeof(p_addons) = 'array' then p_addons else '[]'::jsonb end) e
                     where e ->> 'option_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) s;
$$;
comment on function public.horeca_line_allergens(uuid, jsonb) is 'KEUKEN-VEILIG-1: EU-allergenen van product + gekozen extra''s, voor de keukenbon.';
-- Enkel de kassafuncties (security definer, eigenaar) roepen dit aan.
revoke all on function public.horeca_line_allergens(uuid, jsonb) from public, anon, authenticated;

-- b + d. horeca_apply_one -------------------------------------------------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_apply_one'::regproc);
  pairs text[] := array[
    -- b1. kolom note op de bon
    $a$insert into public.kitchen_tickets (tenant_id, source, service_type, customer_label, table_label, check_id, round_id, station_id, items, paid, status)$a$,
    $a$insert into public.kitchen_tickets (tenant_id, source, service_type, customer_label, table_label, check_id, round_id, station_id, items, paid, status, note)$a$,
    -- b2. allergenen per regel
    $a$jsonb_agg(jsonb_build_object('name', x.name, 'quantity', x.qty, 'note', x.note, 'course', x.course,$a$,
    $a$jsonb_agg(jsonb_build_object('name', x.name, 'quantity', x.qty, 'note', x.note, 'course', x.course,
        'allergens', public.horeca_line_allergens(x.product_id, x.addons),$a$,
    -- b3. de algemene opmerking van de QR-gast op ELKE bon van de ronde (KEUKEN-VEILIG-1)
    $a$      false, 'new'
    from public.check_lines x
    where x.check_id = c.id and x.state = 'draft' and x.id = any(v_ids)$a$,
    $a$      false, 'new',
      -- KEUKEN-VEILIG-1: de algemene opmerking van de QR-aanvraag (allergie!) op elke bon van de ronde,
      -- niet enkel bij lijn 1. Zelfde tekst als horeca_table_request_accept op lijn 1 zet.
      (select string_agg(distinct left(btrim(concat_ws(' · ', case when r.guest_name is not null then 'QR ' || r.guest_name else 'QR' end, r.note)), 200), ' / ')
         from public.table_requests r
        where r.tenant_id = p_tenant_id and r.check_id = c.id and r.status = 'accepted'
          and nullif(btrim(coalesce(r.note, '')), '') is not null and r.line_ids && v_ids)
    from public.check_lines x
    where x.check_id = c.id and x.state = 'draft' and x.id = any(v_ids)$a$,
    -- d. set_note wist de gang niet meer
    $a$update public.check_lines set note = nullif(left(btrim(cmd ->> 'note'), 200), ''), course = nullif(cmd ->> 'course', '')::integer where id = l.id;$a$,
    $a$update public.check_lines set note = nullif(left(btrim(cmd ->> 'note'), 200), ''),
      -- KEUKEN-VEILIG-1: zonder 'course' in het commando blijft de gang staan.
      course = case when cmd ? 'course' then nullif(cmd ->> 'course', '')::integer else l.course end where id = l.id;$a$
  ];
  i integer;
begin
  if position('KEUKEN-VEILIG-1' in d) > 0 then
    raise notice 'KEUKEN-VEILIG-1: horeca_apply_one al gepatcht';
    return;
  end if;
  for i in 1 .. array_length(pairs, 1) / 2 loop
    if (length(d) - length(replace(d, pairs[2 * i - 1], ''))) / length(pairs[2 * i - 1]) <> 1 then
      raise exception 'KEUKEN-VEILIG-1: anker % niet precies één keer gevonden in horeca_apply_one', i;
    end if;
    d := replace(d, pairs[2 * i - 1], pairs[2 * i]);
  end loop;
  execute d;
end
$patch$;

-- c. horeca_pay (toog) ----------------------------------------------------------------------------
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_pay(uuid, text, jsonb)'::regprocedure);
  anchor text := $a$jsonb_agg(jsonb_build_object('name', x.name, 'quantity', x.qty, 'note', x.note, 'course', x.course,$a$;
  repl text := $a$jsonb_agg(jsonb_build_object('name', x.name, 'quantity', x.qty, 'note', x.note, 'course', x.course,
        -- KEUKEN-VEILIG-1: allergenen per regel op de toogbon.
        'allergens', public.horeca_line_allergens(x.product_id, x.addons),$a$;
begin
  if position('KEUKEN-VEILIG-1' in d) > 0 then
    raise notice 'KEUKEN-VEILIG-1: horeca_pay al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KEUKEN-VEILIG-1: anker items niet precies één keer gevonden in horeca_pay';
  end if;
  execute replace(d, anchor, repl);
end
$patch$;

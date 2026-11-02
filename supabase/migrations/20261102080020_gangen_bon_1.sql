-- GANGEN-BON-1 — de keukenbon toont geen lijnen meer die nog op vrijgave wachten.
--
-- GANGEN-1 (20261101230220) zette in send_round de ONTWERP-lijnen van een latere gang van dezelfde
-- post ter info op de bon ('waiting': true). Volgens de GKS-eisenmatrix is een keuken-/barbon een
-- gevolg van een P/ORDER (PRT-05) en hoort bij elke aanmaak van een bestelling een signOrder (EVT-06):
-- een productiebon mag dus niets tonen dat nog niet besteld is. Beslissing Akke (VERVOLG-1): weghalen.
-- De kassa (CheckScreen) blijft "wacht" tonen aan de bediening; dat komt uit check_lines, niet uit de bon.
-- Het keukenscherm en _shared/horecaPrint.ts blijven 'waiting' kunnen renderen (oude bonnen in
-- kitchen_tickets behouden hun items); nieuwe bonnen bevatten het gewoon niet meer.
--
-- Ankermethode: pg_get_functiondef + replace, anker precies één keer (live nagetrokken op 2-11-2026,
-- read-only), idempotent via de marker 'GANGEN-BON-1'. Breekt af als GANGEN-1 niet live staat.
--
-- Handmatig terugdraaien:
--   select name, def from ops.gangen_bon_1_prev_functions;  -- en die definitie opnieuw uitvoeren

create schema if not exists ops;
create table if not exists ops.gangen_bon_1_prev_functions as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, now() as saved_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'horeca_apply_one';
revoke all on ops.gangen_bon_1_prev_functions from anon, authenticated;

do $patch$
declare
  d text := pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure);
  anchor text := $a$        order by x.course nulls first, x.seq)
      -- GANGEN-1: wat nog wacht op vrijgave (ontwerp, niet besteld), ter info en apart op de bon.
      || coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'quantity', w.qty, 'note', w.note, 'course', w.course,
             'allergens', public.horeca_line_allergens(w.product_id, w.addons), 'waiting', true,
             'addons', (select coalesce(jsonb_agg(jsonb_build_object('name', a ->> 'name')), '[]'::jsonb) from jsonb_array_elements(w.addons) a))
             order by w.course, w.seq)
           from public.check_lines w
          where w.check_id = c.id and w.state = 'draft' and w.qty > 0 and w.course is not null and not (w.id = any(v_ids))
            and w.station_id is not distinct from x.station_id
            and exists (select 1 from public.horeca_pay_settings s where s.tenant_id = p_tenant_id and s.courses_enabled)), '[]'::jsonb),
      false, 'new',$a$;
  repl text := $a$        order by x.course nulls first, x.seq),
      -- GANGEN-BON-1: enkel wat in deze ronde besteld wordt (P/ORDER); wat nog wacht staat niet op de bon.
      false, 'new',$a$;
begin
  if position('GANGEN-BON-1' in d) > 0 then
    raise notice 'GANGEN-BON-1: horeca_apply_one al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'GANGEN-BON-1: anker (wachtende lijnen op de bon) niet precies één keer gevonden in horeca_apply_one';
  end if;
  execute replace(d, anchor, repl);
end
$patch$;

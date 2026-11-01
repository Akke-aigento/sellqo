-- KEUKEN-VEILIG-1b — de ober krijgt ook voor drank een "klaar"-melding.
--
-- Sinds KEUKEN-VEILIG-1 werkt de barpost een bon in één tik af (nieuw → afgewerkt, zonder 'ready').
-- horeca_device_push_tr (MELDING-1) meldde 'ticket_ready' enkel bij een overgang naar 'ready', dus een
-- barbon gaf geen push meer. Nu ook: een bon van een BARpost die rechtstreeks van nieuw of in bereiding
-- naar afgewerkt gaat. Een bon die eerst op 'ready' stond en dan afgewerkt wordt (old.status = 'ready'),
-- meldt niet opnieuw: geen dubbele melding.
--
-- Aanpak: pg_get_functiondef + replace op één anker (precies één keer, nagetrokken op de live DB op
-- 1-11-2026), idempotent via de marker 'KEUKEN-VEILIG-1b'. De vorige definitie in
-- ops.keuken_veilig_1b_prev_functions.
-- Handmatig terugdraaien: select def from ops.keuken_veilig_1b_prev_functions where name = 'horeca_device_push_tr';
-- en die definitie opnieuw uitvoeren.

create schema if not exists ops;
create table if not exists ops.keuken_veilig_1b_prev_functions as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, now() as saved_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'horeca_device_push_tr';

do $patch$
declare
  d text := pg_get_functiondef('public.horeca_device_push_tr'::regproc);
  anchor text := $a$        if new.status = 'ready' and old.status is distinct from 'ready' then$a$;
  repl text := $a$        if (new.status = 'ready' and old.status is distinct from 'ready')
           -- KEUKEN-VEILIG-1b: barpost in één tik (nieuw/in bereiding → afgewerkt): toch "klaar" voor de ober.
           or (new.status = 'done' and old.status in ('new', 'preparing')
               and exists (select 1 from public.prep_stations s where s.id = v_station and s.kind = 'bar')) then$a$;
begin
  if position('KEUKEN-VEILIG-1b' in d) > 0 then
    raise notice 'KEUKEN-VEILIG-1b: horeca_device_push_tr al gepatcht';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KEUKEN-VEILIG-1b: anker niet precies één keer gevonden in horeca_device_push_tr';
  end if;
  execute replace(d, anchor, repl);
end
$patch$;

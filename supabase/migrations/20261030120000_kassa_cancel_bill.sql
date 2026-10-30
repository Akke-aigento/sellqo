-- KASSA-UX-4 — "rekening-vraag intrekken": een tafel die per ongeluk op "rekening gevraagd" (blauw)
-- staat, terug op gewoon bezet. Nieuw commando `cancel_bill` in horeca_apply_one: zet enkel
-- dining_checks.bill_requested_at terug op null. De ondertekende voorlopige rekening (fiscaal event
-- P/PRE_BILL) blijft bestaan; er wordt niets gewist of gewijzigd in fiscal_events.
--
-- Aanpak: de live functie wordt uitgebreid met één elsif-tak vóór 'rename_check', via
-- pg_get_functiondef + replace (één anker, precies één keer). Zo blijft alles wat sinds de laatste
-- migratie live aan de functie veranderde, behouden. Idempotent: bevat de functie al 'cancel_bill',
-- dan gebeurt er niets.
-- Handmatig terugdraaien: dezelfde aanpak, de tak "elsif v_kind = 'cancel_bill' … " weer weghalen.
do $patch$
declare
  d text := pg_get_functiondef('public.horeca_apply_one'::regproc);
  anchor text := E'  elsif v_kind = ''rename_check'' then';
  branch text := E'  elsif v_kind = ''cancel_bill'' then\n'
              || E'    -- KASSA-UX-4: status terug naar bezet; het fiscale event van de voorrekening blijft.\n'
              || E'    update public.dining_checks set bill_requested_at = null, version = version + 1, updated_at = now() where id = c.id;\n\n';
begin
  if position('cancel_bill' in d) > 0 then
    raise notice 'KASSA-UX-4: cancel_bill bestaat al';
    return;
  end if;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'KASSA-UX-4: anker rename_check niet precies één keer gevonden in horeca_apply_one';
  end if;
  execute replace(d, anchor, branch || anchor);
end
$patch$;

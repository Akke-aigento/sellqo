-- WANDELING — helpartikel horeca-werkplek: nieuwe onderbalk op de gsm en Instellingen › Horeca.
-- PAS DRAAIEN NA de publish van de admin (branch night-wandeling op main). md5-guard; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: de twee vervangingen omdraaien (oude tekst staat hieronder als a1/a2).
do $doc$
declare
  d text;
  a1 text := '<p>Onderaan staan Dashboard, Bestellingen, Bestellen (je kaart) en Keuken.</p>';
  b1 text := '<p>Onderaan staan de vier plekken waar je de hele dag tussen wisselt: <strong>Vandaag</strong> (je dashboard), <strong>Kassa</strong> (opent SellQo Kassa), <strong>Keuken</strong> en <strong>Kaart</strong> (iets op "op" zetten of terugzetten). Al de rest vind je in het menu bovenaan.</p>';
  a2 text := '<li><strong>Betalingen</strong>, <strong>Rapporten</strong>, <strong>Inkoop</strong>, <strong>Instellingen</strong> en <strong>Help</strong>.</li>';
  b2 text := '<li><strong>Betalingen</strong>, <strong>Rapporten</strong>, <strong>Inkoop</strong>, <strong>Instellingen</strong> en <strong>Help</strong>. In <strong>Instellingen › Horeca</strong> zie je al je horeca-instellingen met hun huidige stand, met een link naar de plek waar je ze aanpast.</li>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-werkplek';
  if d is null then raise notice 'WANDELING docs: artikel ontbreekt'; return; end if;
  if position('Instellingen › Horeca' in d) > 0 then raise notice 'WANDELING docs: al bijgewerkt'; return; end if;
  if md5(d) <> 'c77f80769393e0be1fe68355666a235e' then raise exception 'WANDELING docs: artikel wijkt af (md5 %)', md5(d); end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'WANDELING docs: ankertekst niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(replace(d, a1, b1), a2, b2), updated_at = now()
   where doc_level = 'tenant' and slug = 'horeca-werkplek';
end
$doc$;

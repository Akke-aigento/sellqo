-- KASSA-START-1 — helpartikel kassa-tafels-rekeningen: sectie "De eerste keer op een toestel".
-- PAS DRAAIEN NA de publish van de admin (kassa 0.12.0). md5-guard; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: de sectie b weer vervangen door a (a staat hieronder).
do $doc$
declare
  d text;
  a text := 'of staat op een naam (bv. aan de toog).</p>';
  b text := 'of staat op een naam (bv. aan de toog).</p>

<h2>De eerste keer op een toestel</h2>
<p>Open je de kassa voor het eerst op een tablet of gsm, dan kies je eenmalig welke kassa dat toestel is. Meerdere toestellen mogen bij dezelfde kassa horen. Heeft je zaak nog geen kassa, dan maakt de zaakvoerder er daar meteen een aan met <strong>Kassa aanmaken</strong>; het toestel hangt er dan aan. Personeel ziet die knop niet en vraagt het aan de zaakvoerder. Kassa''s beheren (naam, verwijderen) doe je in SellQo onder <strong>Kassa (POS)</strong>.</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  if d is null then raise notice 'KASSA-START-1 docs: artikel ontbreekt'; return; end if;
  if position('De eerste keer op een toestel' in d) > 0 then raise notice 'KASSA-START-1 docs: al bijgewerkt'; return; end if;
  if md5(d) <> 'd7984b2a2b9ad93fb6099791aab56f90' then raise exception 'KASSA-START-1 docs: artikel wijkt af (md5 %)', md5(d); end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'KASSA-START-1 docs: ankertekst niet precies één keer gevonden'; end if;
  update public.doc_articles set content = replace(d, a, b), updated_at = now()
   where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
end
$doc$;

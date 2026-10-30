-- RESERVATIE-2 — helpartikel "reservaties": online reserveren door gasten.
-- PAS DRAAIEN NA de publish van de admin. Anker precies één keer; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: de sectie <h2>Online reserveren</h2> weer weghalen.
do $doc$
declare
  d text;
  a1 text := '<h2>Privacy</h2>';
  b1 text := '<h2>Online reserveren</h2>
<p>Gasten kunnen ook zelf een tafel aanvragen op je webshop (<em>jouwzaak</em>.sellqo.shop/reserveren). Zet het aan onder <strong>Bestellen › Reservaties › Online reserveren</strong> en kies:</p>
<ul>
  <li>per weekdag het eerste en het laatste aankomstuur (dagen zonder uren zijn online dicht; je sluitingsdagen gelden ook);</li>
  <li>om de hoeveel minuten gasten kunnen aankomen, het maximum aantal personen per aankomstuur en het grootste gezelschap;</li>
  <li>hoeveel dagen vooruit en hoe laat op voorhand er nog online gereserveerd mag worden.</li>
</ul>
<p>Staat het aan, dan krijgt je webshop een knop <strong>Reserveren</strong>. Een aanvraag staat <strong>oranje</strong> bovenaan Bestellen › Reservaties en in de lijst op de kassa, en je krijgt een melding. Een aanvraag kleurt nog geen tafel. Kies <em>Bevestigen</em> of <em>Weigeren</em>: de gast krijgt meteen een mail in de taal van je zaak. Een tafel kies je met <em>Wijzigen</em>.</p>

<h2>Privacy</h2>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'reservaties';
  if d is null then raise exception 'RESERVATIE-2 docs: reservaties ontbreekt (eerst 20261030200100_reservatie_1_docs)'; end if;
  if position('<h2>Online reserveren</h2>' in d) > 0 then
    raise notice 'RESERVATIE-2 docs: al bijgewerkt';
    return;
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'RESERVATIE-2 docs: anker niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(d, a1, b1), updated_at = now()
   where doc_level = 'tenant' and slug = 'reservaties';
end
$doc$;

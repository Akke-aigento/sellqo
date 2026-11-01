-- PERSONEEL-2 — helpartikel kassapersoneel-pincodes: in/uitklokken over toestellen heen, urenoverzicht,
-- correcties, CSV en fooienpot. Anker nagetrokken op de live inhoud (query_database, 01-11-2026).
-- PAS DRAAIEN NA 20261101230600_personeel_2_uren.sql en NA de publish van de admin.
-- Al bijgewerkt = overslaan. Handmatig terugdraaien: de nieuwe tekst (b) weer vervangen door het anker (a).
do $doc$
declare
  d text;
  a text := '<p>Op het startscherm van de kassa klokt een medewerker in en uit. Aanmelden met je pincode is geen inklokken: dat zijn twee aparte handelingen.</p>';
  b text := '<p>Op het startscherm van de kassa klokt een medewerker in en uit. Aanmelden met je pincode is geen inklokken: dat zijn twee aparte handelingen.</p>
<p>Inklokken geldt voor de hele zaak: klok je in op de ene tablet, dan toont elke andere kassa je ook als ingeklokt, en je kan op een ander toestel uitklokken.</p>

<h2>Urenoverzicht</h2>
<p>Onder <strong>Kassa › Personeel</strong> staat onder de medewerkers het blok <strong>Uren</strong>: per medewerker en per dag de gewerkte uren van de gekozen week. Een shift telt bij de dag waarop hij begon (met hetzelfde afkapuur als je Z-rapport, dus een avondshift tot na middernacht blijft bij die avond).</p>
<ul>
  <li><strong>Nog ingeklokt</strong>: wie vergeten is uit te klokken, staat bovenaan. Met <strong>Afsluiten</strong> vul je het einde in. Tot dan telt die shift niet mee.</li>
  <li><strong>Corrigeren</strong>: tik op een shift om begin of einde aan te passen of hem te schrappen. Een reden is verplicht. De oorspronkelijke kloktijd blijft bewaard en je ziet bij de shift dat hij gecorrigeerd is.</li>
  <li><strong>Shift toevoegen</strong>: voor wie helemaal vergat te klokken.</li>
  <li><strong>CSV voor het sociaal secretariaat</strong>: één regel per shift (datum, in, uit, minuten en uren met komma) en een totaal per medewerker.</li>
</ul>

<h2>Fooienpot</h2>
<p>Kreeg je fooien via de kassa of de QR-betaling, dan toont het urenblok per dag hoe die verdeeld worden volgens de gewerkte uren van die dag. Dat is enkel een berekening: SellQo boekt of betaalt niets uit.</p>
<p>In een zaak met zwarte doos blijft in- en uitklokken een geregistreerde handeling; een correctie in het urenoverzicht wijzigt die registratie niet.</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassapersoneel-pincodes';
  if d is null then raise exception 'PERSONEEL-2 docs: kassapersoneel-pincodes ontbreekt'; end if;
  if position('<h2>Urenoverzicht</h2>' in d) > 0 then raise notice 'PERSONEEL-2 docs: al bijgewerkt'; return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'PERSONEEL-2 docs: anker niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(d, a, b), updated_at = now()
   where doc_level = 'tenant' and slug = 'kassapersoneel-pincodes';
end
$doc$;

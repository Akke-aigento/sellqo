-- RESERVATIE-1 — helpartikels: nieuw artikel "reservaties" (Bestellen › Reservaties) en een
-- paragraaf in kassa-tafels-rekeningen. PAS DRAAIEN NA de publish van de admin.
-- Nieuw artikel: ON CONFLICT (doc_level, slug) DO UPDATE. Kassa-artikel: anker precies één keer,
-- al bijgewerkt = overslaan. Handmatig terugdraaien: artikel 'reservaties' op is_published=false,
-- en in kassa-tafels-rekeningen de sectie <h2>Reservaties</h2> weer weghalen.
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, context_path, sort_order, tags, is_published)
values (
  'a0000001-0000-0000-0000-000000000006', 'tenant',
  'Reservaties: tafels reserveren in het beheer en op de kassa',
  'reservaties',
  'Reserveer een tafel voor een naam, uur en aantal personen. Op de kassa kleurt de tafel paars; een open rekening gaat altijd voor.',
  $html$
<p>Met <strong>reservaties</strong> zet je een tafel opzij voor een naam, een uur en een aantal personen. Je beheert ze in SellQo onder <strong>Bestellen › Reservaties</strong>, en op SellQo Kassa via het zaalplan.</p>

<h2>Een reservatie maken</h2>
<ul>
  <li><strong>In het beheer:</strong> Bestellen › Reservaties › <em>Nieuwe reservatie</em>. Met de pijlen blader je per dag.</li>
  <li><strong>Op de kassa:</strong> lang drukken op een tafel › <em>Reserveren</em>, of de knop <strong>Reservaties</strong> boven het zaalplan › <em>Nieuwe reservatie</em>.</li>
  <li>Je vult een naam, het aantal personen, de datum en het uur in. Een tafel kiezen mag later. Een gsm-nummer en een opmerking (bv. verjaardag, kinderstoel) zijn optioneel.</li>
</ul>

<h2>Op het zaalplan</h2>
<ul>
  <li>Een gereserveerde tafel kleurt <strong>paars</strong> met het uur, de naam en het aantal personen, vanaf een uur vooraf. Dat stel je in onder Bestellen › Reservaties › <em>Weergave in de kassa</em>.</li>
  <li>Zitten er nog gasten met een <strong>open rekening</strong> aan die tafel, dan blijft ze groen en staat het uur van de reservatie er enkel bij ("res. 20:00"). Een reservatie verandert nooit iets aan een rekening.</li>
  <li>Zijn de gasten er, tik dan op de paarse tafel: de rekening opent zoals altijd en de reservatie staat op <em>aangekomen</em>.</li>
  <li>Zijn ze later dan het ingestelde aantal minuten, dan toont de kassa <em>te laat</em>. De tafel blijft gereserveerd tot jij of je personeel <em>Niet gekomen</em> of <em>Annuleren</em> kiest. Niets gebeurt vanzelf.</li>
</ul>

<h2>Wijzigen, annuleren, terugzetten</h2>
<p>Lang drukken op een paarse tafel, of de lijst van vandaag, geeft <em>Wijzigen</em>, <em>Niet gekomen</em> en <em>Annuleren</em>. Een vergissing zet je met <em>Terugzetten</em> weer op geboekt. Reservaties worden nooit gewist.</p>

<h2>Privacy</h2>
<p>Enkel de zaakvoerder en het personeel zien reservaties. Een gsm-nummer wordt 30 dagen na de reservatie automatisch gewist.</p>
$html$,
  '/admin/bestellen', 6, array['horeca', 'reservaties', 'kassa', 'zaalplan'], true
)
on conflict (doc_level, slug) do update set title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  context_path = excluded.context_path, tags = excluded.tags, updated_at = now();

do $doc$
declare
  d text;
  a1 text := '<h2>Met meerdere toestellen, en zonder internet</h2>';
  b1 text := '<h2>Reservaties</h2>
<p>Een gereserveerde tafel kleurt <strong>paars</strong> met uur, naam en aantal personen (standaard vanaf een uur vooraf). Tik erop als de gasten er zijn: de rekening opent en de reservatie staat op aangekomen. Lang drukken op een tafel › <strong>Reserveren</strong> maakt een nieuwe; de knop <strong>Reservaties</strong> boven het zaalplan toont de lijst van vandaag. Een reservatie verandert nooit iets aan een open rekening. Meer in <strong>Reservaties: tafels reserveren in het beheer en op de kassa</strong>.</p>

<h2>Met meerdere toestellen, en zonder internet</h2>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  if d is null then raise exception 'RESERVATIE-1 docs: kassa-tafels-rekeningen ontbreekt'; end if;
  if position('<h2>Reservaties</h2>' in d) > 0 then
    raise notice 'RESERVATIE-1 docs: kassa-tafels-rekeningen al bijgewerkt';
    return;
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'RESERVATIE-1 docs: anker in kassa-tafels-rekeningen niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(d, a1, b1), updated_at = now()
   where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
end
$doc$;

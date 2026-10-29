-- ONDERBALK-1 — helpartikel "Je onderbalk op de gsm aanpassen" + één zin in horeca-werkplek.
-- PAS DRAAIEN NA 20261029030000_onderbalk_1.sql, de publish van de admin én 20261029020000_wandeling_docs.sql.
-- Idempotent: het artikel via ON CONFLICT DO NOTHING, de zin enkel als hij er nog niet staat.
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'onderbalk-aanpassen';
--   en in horeca-werkplek de zin b (hieronder) weer weghalen.

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published, tags)
values ('tenant', 'a0000001-0000-0000-0000-00000000000c', '/admin/settings?section=bottom-nav', 'onderbalk-aanpassen',
  'Je onderbalk op de gsm aanpassen',
  'Kies zelf welke 2 tot 5 snelkoppelingen onderaan op je gsm staan, en in welke volgorde. Dat geldt enkel voor jou.',
  $c$
<p>Op je gsm staat onderaan een balk met snelkoppelingen. Welke daar staan, kies je zelf in <strong>Instellingen › Mijn onderbalk</strong>. Je komt er ook via <em>Personaliseer menu</em> onderaan het menu.</p>

<h2>Zo pas je hem aan</h2>
<ul>
  <li>Bovenaan zie je meteen hoe de balk eruit zal zien.</li>
  <li>Met de pijltjes zet je een snelkoppeling hoger of lager. Met het kruisje haal je hem weg. Je houdt er minstens 2.</li>
  <li>Onder <em>Toevoegen</em> staan alle plekken uit het menu die jij mag openen. Tik erop om ze toe te voegen, tot er 5 staan.</li>
  <li>Elke wijziging wordt meteen bewaard. Met <em>Terug naar de standaard</em> wis je je eigen keuze.</li>
</ul>

<h2>Goed om te weten</h2>
<ul>
  <li>Je keuze geldt enkel voor jou, in deze zaak. Je collega's kiezen hun eigen balk.</li>
  <li>Kies je niets, dan krijg je de standaard die bij je zaak past. Een horecazaak krijgt Vandaag, Kassa, Keuken en Kaart (met een webshop: Bestellingen in plaats van Kassa). Een webshop krijgt Dashboard, Bestellingen, Producten en Inbox.</li>
  <li>Verlies je de toegang tot een plek, bijvoorbeeld door een andere rol of een ander pakket, dan valt die snelkoppeling vanzelf weg. Blijft er minder dan 2 over, dan krijg je weer de standaard.</li>
  <li>Op een computer is er geen onderbalk; daar gebruik je het menu links.</li>
</ul>
$c$, 50, true, array['gsm', 'onderbalk', 'menu', 'snelkoppelingen'])
on conflict (doc_level, slug) do nothing;

do $doc$
declare
  d text;
  a text := 'Al de rest vind je in het menu bovenaan.</p>';
  b text := 'Al de rest vind je in het menu bovenaan. Wil je andere snelkoppelingen? Die kies je zelf in <strong>Instellingen › Mijn onderbalk</strong>.</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-werkplek';
  if d is null then raise notice 'ONDERBALK-1 docs: horeca-werkplek ontbreekt'; return; end if;
  if position('Mijn onderbalk' in d) > 0 then raise notice 'ONDERBALK-1 docs: al bijgewerkt'; return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'ONDERBALK-1 docs: ankertekst niet precies één keer gevonden (eerst wandeling_docs draaien?)';
  end if;
  update public.doc_articles set content = replace(d, a, b), updated_at = now()
   where doc_level = 'tenant' and slug = 'horeca-werkplek';
end
$doc$;

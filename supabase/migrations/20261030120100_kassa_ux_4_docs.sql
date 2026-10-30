-- KASSA-UX-4 — helpartikel kassa-tafels-rekeningen volgt kassa 0.16.0: "−" in het formaatvenster,
-- + en − en vegen in het rekeninglijstje, rekening-vraag intrekken, en "Bereiden aan" per product.
-- PAS DRAAIEN NA de publish van de admin, en NA 20261029070000_kassa_ux_3_docs (bouwt op die tekst).
-- Ankers per zin, elk precies één keer; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: per anker de nieuwe tekst (b) weer vervangen door de oude (a).
do $doc$
declare
  d text;
  a1 text := 'Dezelfde keuze komt op één lijn (5× Pils 25 cl).</li>';
  b1 text := 'Dezelfde keuze komt op één lijn (5× Pils 25 cl). Met <strong>−</strong> op een maat haal je er één af.</li>';
  a2 text := 'Wat naar welke post gaat (keuken, bar, …) stel je in onder <strong>Bestellen › Posten</strong>;';
  b2 text := 'Wat naar welke post gaat (keuken, bar, …) stel je per categorie in onder <strong>Bestellen › Posten</strong>, en voor één product onder <strong>Bereiden aan</strong> in dat product (dat wint van de categorie: zo kan de salami aan de toog terwijl de rest van de hapjes naar de keuken gaat);';
  a3 text := '<p>Een lijn die nog niet verstuurd is, pas je vrij aan (aantal, opmerking, weghalen). Een verstuurde lijn kan je enkel nog <strong>annuleren met een reden</strong>; de keuken krijgt dan een annuleringsbon.</p>';
  b3 text := '<p>Een lijn die nog niet verstuurd is, pas je vrij aan (aantal, opmerking, weghalen). Een verstuurde lijn kan je enkel nog <strong>annuleren met een reden</strong>; de keuken krijgt dan een annuleringsbon.</p>
<p>In het lijstje van de rekening heeft elke lijn een <strong>−</strong> en een <strong>+</strong>, en <strong>naar links vegen</strong> haalt een lijn weg. Op een lijn die nog niet verstuurd is, gebeurt dat meteen. Op een verstuurde lijn vraagt de kassa eerst waarom je annuleert. Tik je op de naam, dan zie je alles van die lijn (opmerking, korting, verplaatsen).</p>';
  a4 text := 'de tafel kleurt blauw. Bijbestellen kan daarna nog.</li>';
  b4 text := 'de tafel kleurt blauw. Bijbestellen kan daarna nog. Per ongeluk gevraagd? Lang drukken op de tafel (of <strong>⋯</strong> in de rekening) › <strong>Rekening-vraag intrekken</strong> zet de tafel terug op groen; de voorlopige rekening zelf blijft bewaard.</li>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  if d is null then raise exception 'KASSA-UX-4 docs: kassa-tafels-rekeningen ontbreekt'; end if;
  if position('Rekening-vraag intrekken' in d) > 0 then
    raise notice 'KASSA-UX-4 docs: kassa-tafels-rekeningen al bijgewerkt';
    return;
  end if;
  if position('<strong>Lang drukken</strong> op een tafel' in d) = 0 then
    raise exception 'KASSA-UX-4 docs: eerst 20261029070000_kassa_ux_3_docs draaien';
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1
     or (length(d) - length(replace(d, a3, ''))) / length(a3) <> 1 or (length(d) - length(replace(d, a4, ''))) / length(a4) <> 1 then
    raise exception 'KASSA-UX-4 docs: anker in kassa-tafels-rekeningen niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(replace(replace(replace(d, a1, b1), a2, b2), a3, b3), a4, b4), updated_at = now()
   where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
end
$doc$;

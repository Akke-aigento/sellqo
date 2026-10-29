-- KASSA-UX-1 — helpartikels van SellQo Kassa volgen de nieuwe bediening (kassa 0.13.0):
-- toog als knop bovenaan, ⋯-menu met Kas/Rapporten/naar beheer, opgeteld tikken, Populair.
-- PAS DRAAIEN NA de publish van de admin. md5-guard per artikel; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: per artikel de nieuwe tekst (b) weer vervangen door de oude (a).
do $doc$
declare
  d text;
  a1 text := '<h2>Het tafeloverzicht</h2>';
  b1 text := '<h2>Rondkijken op de kassa</h2>
<ul>
  <li>Je start altijd op je <strong>tafeloverzicht</strong>. Bovenaan staat de knop <strong>Toog / snelverkoop</strong> voor een verkoop zonder tafel.</li>
  <li>Rechtsboven wissel je van medewerker met <strong>Wissel</strong>. Onder <strong>⋯</strong> vind je <strong>Kas</strong>, <strong>Rapporten</strong>, in- en uitklokken, de meldingen en geluiden van dit toestel en <strong>Andere kassa kiezen</strong> (dat vraagt eerst of je zeker bent).</li>
  <li>De eigenaar en een verantwoordelijke zien daar ook <strong>Naar SellQo-beheer</strong>, om terug naar je dashboard en instellingen te gaan.</li>
  <li>In een rekening zie je enkel die rekening. Met de pijl links ga je terug naar je tafels.</li>
</ul>

<h2>Het tafeloverzicht</h2>';
  a2 text := '<li>Tik een tafel aan. Onder <strong>Kaart</strong> zie je je producten met kanaal "kassa"; producten die op zijn, zijn grijs.</li>
  <li>Tik een product aan. Heeft het extra''s (bv. saus, cuisson), dan kies je die eerst.</li>';
  b2 text := '<li>Tik een tafel aan. De kaart opent op <strong>Populair</strong> (je meest verkochte producten van de laatste 30 dagen) of, zolang er nog te weinig verkopen zijn, op je eerste categorie. Je ziet enkel producten met kanaal "kassa"; producten die op zijn, zijn grijs. Met het vergrootglas zoek je op naam.</li>
  <li>Tik een product aan: dat is er één bij. Tik je hetzelfde product nog eens, dan wordt het 2×, 3× … op dezelfde lijn. Op de knop zie je hoeveel er in deze ronde staan; met <strong>−</strong> haal je er één af. Heeft een product extra''s (bv. saus, cuisson), dan kies je die eerst en krijgt het een eigen lijn.</li>
  <li>Op een gsm staat onderaan hoeveel stuks en welk bedrag er op de rekening staan. Tik erop om de rekening te zien, en nog eens om terug naar de kaart te gaan. Op een tablet in liggende stand staan rekening en kaart naast elkaar.</li>';
  a3 text := '<p>SellQo Kassa heeft vier tabbladen: <strong>Tafels</strong>, <strong>Toog</strong>, <strong>Kas</strong> en <strong>Rapporten</strong>.</p>';
  b3 text := '<p>Een toogverkoop start je met de knop <strong>Toog / snelverkoop</strong> bovenaan je tafeloverzicht. <strong>Kas</strong> en <strong>Rapporten</strong> vind je onder <strong>⋯</strong> rechtsboven.</p>';
  a4 text := '<li>Tik op <strong>Toog</strong>. Er opent meteen een nieuwe verkoop.</li>';
  b4 text := '<li>Tik op <strong>Toog / snelverkoop</strong>. Er opent meteen een nieuwe verkoop.</li>';
begin
  -- 1. Tafels en rekeningen
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  if d is null then raise exception 'KASSA-UX-1 docs: kassa-tafels-rekeningen ontbreekt'; end if;
  if position('Rondkijken op de kassa' in d) > 0 then
    raise notice 'KASSA-UX-1 docs: kassa-tafels-rekeningen al bijgewerkt';
  else
    if md5(d) <> '3ed3da4224c0e38912517af0e29d72cf' then raise exception 'KASSA-UX-1 docs: kassa-tafels-rekeningen wijkt af (md5 %)', md5(d); end if;
    if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
      raise exception 'KASSA-UX-1 docs: anker in kassa-tafels-rekeningen niet precies één keer gevonden';
    end if;
    update public.doc_articles set content = replace(replace(d, a1, b1), a2, b2), updated_at = now()
     where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  end if;

  -- 2. Toog, kas en rapporten
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-toog-kas-rapporten';
  if d is null then raise exception 'KASSA-UX-1 docs: kassa-toog-kas-rapporten ontbreekt'; end if;
  if position('Toog / snelverkoop' in d) > 0 then
    raise notice 'KASSA-UX-1 docs: kassa-toog-kas-rapporten al bijgewerkt';
  else
    if md5(d) <> '5c62ed6a19a87e36f212dedeb2e47ec1' then raise exception 'KASSA-UX-1 docs: kassa-toog-kas-rapporten wijkt af (md5 %)', md5(d); end if;
    if (length(d) - length(replace(d, a3, ''))) / length(a3) <> 1 or (length(d) - length(replace(d, a4, ''))) / length(a4) <> 1 then
      raise exception 'KASSA-UX-1 docs: anker in kassa-toog-kas-rapporten niet precies één keer gevonden';
    end if;
    update public.doc_articles set content = replace(replace(d, a3, b3), a4, b4), updated_at = now()
     where doc_level = 'tenant' and slug = 'kassa-toog-kas-rapporten';
  end if;
end
$doc$;

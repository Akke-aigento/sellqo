-- KASSA-UX-3 — helpartikels volgen kassa 0.15.0: lang drukken op een tafel, bevestiging voor de
-- voorlopige rekening, tabs op naam, formaat snel tikken, keukenbon aan de toog, Keuken/Bar zonder slot.
-- PAS DRAAIEN NA de publish van de admin. md5-guard per artikel; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: per artikel de nieuwe tekst (b) weer vervangen door de oude (a).
do $doc$
declare
  d text;
  a1 text := '<li>Rekeningen op naam staan als knoppen bovenaan. Met <strong>+ Op naam</strong> open je een nieuwe.</li>';
  b1 text := '<li>Rekeningen op naam staan op één rij bovenaan; veeg opzij voor meer, of tik op <strong>Alle</strong> voor de volledige lijst met zoeken. Met <strong>+ Op naam</strong> open je een nieuwe. Je zaalplan verschuift daardoor nooit.</li>
  <li><strong>Lang drukken</strong> op een tafel opent een menu: naar de rekening, een voorlopige rekening, de rekening verplaatsen of samenvoegen, of een lege tafel vrijgeven. Slepen om samen te voegen kan bewust niet, zodat het niet per ongeluk gebeurt.</li>
  <li>In <strong>Keuken</strong> en <strong>Bar</strong> vergrendelt de kassa niet vanzelf: zo blijft een scherm aan de muur open. Ga je na een tijdje terug naar <strong>Zaal</strong>, of zet je een QR-bestelling op de rekening, dan vraagt de kassa eerst je PIN. Onder <strong>Bar</strong> vind je ook wat al opgediend is (uitklappen), met <em>terug</em>.</li>';
  a2 text := 'Heeft een product extra''s (bv. saus, cuisson), dan kies je die eerst en krijgt het een eigen lijn.</li>';
  b2 text := 'Heeft een product extra''s (bv. saus, cuisson), dan kies je die eerst. Is het één keuze zoals 25, 33 of 50 cl, dan blijft het venster open: elke tik is er één bij, met <em>Klaar</em> sluit je het. Dezelfde keuze komt op één lijn (5× Pils 25 cl).</li>';
  a3 text := '<li><strong>Rekening</strong> maakt een voorlopige rekening; de tafel kleurt blauw.</li>';
  b3 text := '<li><strong>Rekening</strong> maakt een voorlopige rekening, na een bevestiging; de tafel kleurt blauw. Bijbestellen kan daarna nog.</li>';
  a4 text := '<li><strong>Keukenbon.</strong> Staat <em>Keukenbon</em> aan, dan krijgt je keuken bij het afrekenen een bon (enkel voor wat niet naar een bar-post gaat). Verkoop je enkel dranken, zet het dan uit.</li>';
  b4 text := '<li><strong>Keukenbon.</strong> Bij het afrekenen krijgt je keuken vanzelf een bon voor wat niet naar een bar-post gaat; verkoop je enkel dranken, dan komt er geen bon. Wil je voor één verkoop toch geen keukenbon, kies dan <em>Zonder keukenbon</em> onder <strong>⋯</strong>.</li>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  if d is null then raise exception 'KASSA-UX-3 docs: kassa-tafels-rekeningen ontbreekt'; end if;
  if position('<strong>Lang drukken</strong> op een tafel' in d) > 0 then
    raise notice 'KASSA-UX-3 docs: kassa-tafels-rekeningen al bijgewerkt';
  else
    if md5(d) <> 'cf40e90ef3ac721578b8419e0e87d575' then raise exception 'KASSA-UX-3 docs: kassa-tafels-rekeningen wijkt af (md5 %)', md5(d); end if;
    if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1
       or (length(d) - length(replace(d, a3, ''))) / length(a3) <> 1 then
      raise exception 'KASSA-UX-3 docs: anker in kassa-tafels-rekeningen niet precies één keer gevonden';
    end if;
    update public.doc_articles set content = replace(replace(replace(d, a1, b1), a2, b2), a3, b3), updated_at = now()
     where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  end if;

  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-toog-kas-rapporten';
  if d is null then raise exception 'KASSA-UX-3 docs: kassa-toog-kas-rapporten ontbreekt'; end if;
  if position('<em>Zonder keukenbon</em>' in d) > 0 then
    raise notice 'KASSA-UX-3 docs: kassa-toog-kas-rapporten al bijgewerkt';
  else
    if md5(d) <> 'a7c0ee6eb10333a0199ec55fe9439140' then raise exception 'KASSA-UX-3 docs: kassa-toog-kas-rapporten wijkt af (md5 %)', md5(d); end if;
    if (length(d) - length(replace(d, a4, ''))) / length(a4) <> 1 then
      raise exception 'KASSA-UX-3 docs: anker in kassa-toog-kas-rapporten niet precies één keer gevonden';
    end if;
    update public.doc_articles set content = replace(d, a4, b4), updated_at = now()
     where doc_level = 'tenant' and slug = 'kassa-toog-kas-rapporten';
  end if;
end
$doc$;

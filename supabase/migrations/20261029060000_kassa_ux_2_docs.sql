-- KASSA-UX-2 — helpartikels volgen kassa 0.14.0: Zaal · Bar · Keuken, kolom Binnenkomend,
-- keukenbord in de kassa, zaalplan op gsm, taal van de zaak, knop Kassa op het keukenscherm.
-- PAS DRAAIEN NA de publish van de admin. md5-guard per artikel; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: per artikel de nieuwe tekst (b) weer vervangen door de oude (a).
do $doc$
declare
  d text;
  a1 text := '<li>In een rekening zie je enkel die rekening. Met de pijl links ga je terug naar je tafels.</li>';
  b1 text := '<li>In een rekening zie je enkel die rekening. Met de pijl links ga je terug naar je tafels.</li>
  <li>Bovenaan wissel je met één tik tussen <strong>Zaal</strong>, <strong>Bar</strong> en <strong>Keuken</strong>. Elk toestel onthoudt waar het stond. Het getal bij Bar en Keuken is wat daar nog wacht.</li>
  <li><strong>Bar</strong> toont wat er binnenkomt: bestellingen via de QR aan tafel (op de rekening zetten of weigeren) en de bonnen voor je post van het type Bar, met <em>Start</em>, <em>Klaar</em> en <em>Opgediend</em>. Op een tablet in liggende stand staat die kolom naast je zaalplan.</li>
  <li><strong>Keuken</strong> toont hetzelfde keukenscherm als in SellQo onder <strong>Keuken</strong>, voor de post die je bovenaan kiest.</li>
  <li>De kassa spreekt de taal van je zaak. Onder <strong>⋯ › Taal</strong> kies je op dit toestel een andere taal, of terug de taal van de zaak.</li>';
  a2 text := '<li>Op een gsm kan je wisselen tussen het zaalplan en een lijst per ruimte.</li>';
  b2 text := '<li>Je kan wisselen tussen het zaalplan en een lijst per ruimte; het toestel onthoudt je keuze. Op een gsm in staande stand draait het zaalplan een kwartslag, zodat je tafels groot genoeg zijn om aan te tikken.</li>';
  a3 text := '<li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>';
  b3 text := '<li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>
  <li>Werk je met SellQo Kassa, dan brengt de knop <strong>Kassa</strong> je meteen naar de kassa. Daar vind je het keukenscherm ook terug onder <strong>Keuken</strong>.</li>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  if d is null then raise exception 'KASSA-UX-2 docs: kassa-tafels-rekeningen ontbreekt'; end if;
  if position('<strong>Zaal</strong>, <strong>Bar</strong>' in d) > 0 then
    raise notice 'KASSA-UX-2 docs: kassa-tafels-rekeningen al bijgewerkt';
  else
    if md5(d) <> '3465c5321be67ea5de2373e05f53d416' then raise exception 'KASSA-UX-2 docs: kassa-tafels-rekeningen wijkt af (md5 %)', md5(d); end if;
    if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
      raise exception 'KASSA-UX-2 docs: anker in kassa-tafels-rekeningen niet precies één keer gevonden';
    end if;
    update public.doc_articles set content = replace(replace(d, a1, b1), a2, b2), updated_at = now()
     where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen';
  end if;

  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'keukenscherm-en-tafelbestelling';
  if d is null then raise exception 'KASSA-UX-2 docs: keukenscherm-en-tafelbestelling ontbreekt'; end if;
  if position('de knop <strong>Kassa</strong>' in d) > 0 then
    raise notice 'KASSA-UX-2 docs: keukenscherm-en-tafelbestelling al bijgewerkt';
  else
    if md5(d) <> '2b874a0bc75df44a2dce90a8507b862d' then raise exception 'KASSA-UX-2 docs: keukenscherm-en-tafelbestelling wijkt af (md5 %)', md5(d); end if;
    if (length(d) - length(replace(d, a3, ''))) / length(a3) <> 1 then
      raise exception 'KASSA-UX-2 docs: anker in keukenscherm-en-tafelbestelling niet precies één keer gevonden';
    end if;
    update public.doc_articles set content = replace(d, a3, b3), updated_at = now()
     where doc_level = 'tenant' and slug = 'keukenscherm-en-tafelbestelling';
  end if;
end
$doc$;

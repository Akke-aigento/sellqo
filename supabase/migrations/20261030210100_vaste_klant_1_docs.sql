-- VASTE-KLANT-1 — helpartikel zaalplan-en-qr-per-tafel: soort "Vaste klant" en de ruimere naamregel.
-- PAS DRAAIEN NA de publish van de admin. Anker precies één keer; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: de nieuwe <li> en zin (b1, b2) weer vervangen door de oude (a1, a2).
do $doc$
declare
  d text;
  a1 text := '<li><strong>Tafel toevoegen</strong>: kies een tafel, barkruk of statafel. Ze komt op de eerste vrije plek en krijgt automatisch het volgende nummer (B1, B2… voor barkrukken).</li>';
  b1 text := '<li><strong>Tafel toevoegen</strong>: kies een tafel, barkruk of statafel. Ze komt op de eerste vrije plek en krijgt automatisch het volgende nummer (B1, B2… voor barkrukken).</li>
  <li><strong>Vaste klant</strong>: een eigen plek op het plan voor een vaste klant, met zijn naam (bv. "Jef" of "Bompa Ré"). Op de kassa opent een tik zijn rekening, op dezelfde plek, elke keer. Een vaste klant heeft geen QR-sticker. Op het kasticket staat zijn rekening als rekening op naam, niet als tafel.</li>';
  a2 text := 'Op een computer of tablet klik je op een tafel om ze aan te passen: naam,';
  b2 text := 'Een naam mag tot 20 tekens tellen, met letters (ook met accenten), cijfers, een spatie en - / . _ of een apostrof. Op een computer of tablet klik je op een tafel om ze aan te passen: naam,';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'zaalplan-en-qr-per-tafel';
  if d is null then raise exception 'VASTE-KLANT-1 docs: zaalplan-en-qr-per-tafel ontbreekt'; end if;
  if position('<strong>Vaste klant</strong>' in d) > 0 then
    raise notice 'VASTE-KLANT-1 docs: al bijgewerkt';
    return;
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'VASTE-KLANT-1 docs: anker niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(replace(d, a1, b1), a2, b2), updated_at = now()
   where doc_level = 'tenant' and slug = 'zaalplan-en-qr-per-tafel';
end
$doc$;

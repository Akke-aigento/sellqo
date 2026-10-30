-- AI-AGENT-2 — helpartikel "hulpassistent-gebruiken": cijfers en extra acties.
-- Alleen tekst. Idempotent (al bijgewerkt = overslaan); anker precies één keer.
-- Handmatig terugdraaien: de sectie <h3>Vragen over je cijfers</h3> weghalen en de actielijst
-- terugzetten zoals in 20261030234100_ai_agent_1_docs.sql.
do $doc$
declare
  d text;
  a1 text := '<h3>Acties laten klaarzetten</h3>';
  b1 text := '<h3>Vragen over je cijfers</h3>
<p>In de betaalde plannen kent de assistent je cijfers. Vraag bijvoorbeeld "wat was mijn omzet vorige zaterdag?", "vergelijk oktober met september", "wat was mijn winst deze maand?", "wat zijn mijn 10 best verkopende producten?" of "maak een lijst van producten zonder foto". Je krijgt dezelfde cijfers als op je dashboard. Een lijst verschijnt als tabel met een knop om ze als CSV te downloaden (opent in Excel).</p>
<ul><li>De winst is omzet zonder btw min de kostprijs. Producten zonder kostprijs tellen niet mee in de marge: de assistent zegt welke dat zijn.</li><li>Sinds 30 oktober 2026 bewaart SellQo de kostprijs bij elke verkoop, zodat de winst vanaf dan exact is. Voor oudere verkopen rekent de assistent met de huidige kostprijs.</li><li>Ook de boekhouder kan cijfers opvragen; wijzigen kunnen enkel beheerders en medewerkers.</li></ul>

<h3>Acties laten klaarzetten</h3>';
  a2 text := 'of "zet de lasagne op uitverkocht voor vandaag".</p>';
  b2 text := 'of "zet de lasagne op uitverkocht voor vandaag". Ook: "maak een nieuwe pizza Diavola van 14 euro" (wordt een concept dat je zelf live zet), "zet alle pizza''s 1 euro duurder" (je ziet elke prijs vooraf), "zet de wintermuts uit" of "maak een kortingscode WELKOM10 voor 10%".</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'hulpassistent-gebruiken';
  if d is null then raise exception 'AI-AGENT-2 docs: hulpassistent-gebruiken ontbreekt'; end if;
  if position('<h3>Vragen over je cijfers</h3>' in d) > 0 then
    raise notice 'AI-AGENT-2 docs: al bijgewerkt';
    return;
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1
     or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'AI-AGENT-2 docs: anker niet precies één keer gevonden (eerst 20261030234100)';
  end if;
  update public.doc_articles set content = replace(replace(d, a1, b1), a2, b2), updated_at = now()
   where doc_level = 'tenant' and slug = 'hulpassistent-gebruiken';
end
$doc$;

-- AI-AGENT-1 — helpartikels: de hulpassistent kan acties klaarzetten (bevestigen, 1 credit).
-- Alleen tekst. Idempotent: al bijgewerkt = overslaan; anker precies één keer, anders fout.
-- Handmatig terugdraaien: de sectie <h3>Acties laten klaarzetten</h3> in hulpassistent-gebruiken
-- en de zin "Acties die de assistent voor je uitvoert ..." in ai-credits weer weghalen.
do $doc$
declare
  d text;
  a1 text := '<h3>Goed om te weten</h3>';
  b1 text := '<h3>Acties laten klaarzetten</h3>
<p>In de betaalde plannen kan de assistent ook dingen voor je aanpassen. Vraag bijvoorbeeld "vul de voorraad van de zwarte hoodie maat M aan met 10", "zet de prijs van de Margherita op 13 euro" of "zet de lasagne op uitverkocht voor vandaag".</p>
<ul><li>De assistent zoekt het product op en toont een kaart met de huidige en de nieuwe waarde.</li><li>Er gebeurt <strong>niets</strong> tot jij op <strong>Uitvoeren</strong> tikt. Met <strong>Annuleren</strong> blijft alles zoals het was.</li><li>Een voorraadwijziging komt in het voorraadlogboek van het product, met de notitie "AI-assistent".</li><li>Elke uitgevoerde actie kost 1 AI-credit. Vragen stellen blijft gratis.</li><li>Alleen beheerders en medewerkers kunnen acties uitvoeren.</li></ul>

<h3>Goed om te weten</h3>';
  a2 text := '<p>Deze hulpassistent kost <strong>geen</strong> credits — die staat altijd voor je klaar, op elk abonnement.</p>';
  b2 text := '<p>Deze hulpassistent kost <strong>geen</strong> credits — die staat altijd voor je klaar, op elk abonnement. Acties die de assistent voor je uitvoert (voorraad, prijs, uitverkocht) kosten 1 credit per uitgevoerde actie, en enkel nadat jij ze bevestigd hebt.</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'hulpassistent-gebruiken';
  if d is null then raise exception 'AI-AGENT-1 docs: hulpassistent-gebruiken ontbreekt'; end if;
  if position('<h3>Acties laten klaarzetten</h3>' in d) = 0 then
    if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then raise exception 'AI-AGENT-1 docs: anker 1'; end if;
    update public.doc_articles set content = replace(d, a1, b1), updated_at = now()
     where doc_level = 'tenant' and slug = 'hulpassistent-gebruiken';
  end if;

  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'ai-credits';
  if d is null then raise exception 'AI-AGENT-1 docs: ai-credits ontbreekt'; end if;
  if position('Acties die de assistent voor je uitvoert' in d) = 0 then
    if (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then raise exception 'AI-AGENT-1 docs: anker 2'; end if;
    update public.doc_articles set content = replace(d, a2, b2), updated_at = now()
     where doc_level = 'tenant' and slug = 'ai-credits';
  end if;
end
$doc$;

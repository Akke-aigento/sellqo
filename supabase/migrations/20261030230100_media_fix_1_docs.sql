-- MEDIA-FIX-1 — helpartikel "productfotos-mediabibliotheek-fotostandaard": volgorde van foto's
-- en echte transparantie bij "achtergrond verwijderen". Alleen tekst; idempotent (al bijgewerkt = overslaan).
-- Handmatig terugdraaien: de twee secties <h2>Volgorde van je foto's</h2> en
-- <h2>Achtergrond transparant maken</h2> weer weghalen.
do $doc$
declare
  d text;
  a1 text := '<h2>Een foto bewerken</h2>';
  b1 text := '<h2>Volgorde van je foto''s</h2>
<p>Op de productpagina sleep je een foto aan het greepje rechtsboven naar een andere plek, of je gebruikt de pijltjes onderaan de foto (handig op je gsm). De <strong>eerste foto is de hoofdfoto</strong>: die zie je in productlijsten en bovenaan de productpagina van je webshop. Met het sterretje zet je een foto meteen vooraan. Klik daarna op <strong>Opslaan</strong>; je webshop toont de foto''s in dezelfde volgorde.</p>

<h2>Een foto bewerken</h2>';
  a2 text := 'Elke bewerking wordt een nieuwe foto: het origineel blijft in je mediabibliotheek.</p>';
  b2 text := 'Elke bewerking wordt een nieuwe foto: het origineel blijft in je mediabibliotheek.</p>

<h2>Achtergrond transparant maken</h2>
<p>Kies je bij <strong>AI-achtergrond</strong> voor <strong>Transparant</strong> (of verwijder je in bulk de achtergrond bij Foto''s of in de mediabibliotheek), dan krijg je een PNG met een echt doorzichtige achtergrond. Dat werkt het best bij een product met duidelijke randen. Lukt het wegknippen niet, dan krijg je een foto met een effen achtergrond in plaats van een half weggeknipte foto; probeer dan een andere foto of kies een witte achtergrond.</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'productfotos-mediabibliotheek-fotostandaard';
  if d is null then raise exception 'MEDIA-FIX-1 docs: artikel ontbreekt'; end if;
  if position('<h2>Volgorde van je foto''s</h2>' in d) > 0 then
    raise notice 'MEDIA-FIX-1 docs: al bijgewerkt';
    return;
  end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1
     or (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'MEDIA-FIX-1 docs: anker niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(replace(d, a1, b1), a2, b2), updated_at = now()
   where doc_level = 'tenant' and slug = 'productfotos-mediabibliotheek-fotostandaard';
end
$doc$;

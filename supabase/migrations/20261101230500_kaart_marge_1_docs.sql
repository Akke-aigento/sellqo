-- KAART-MARGE-1 — helpartikel "De Kaart": kostprijs en foodcost.
-- Geen schemawijziging: products.cost_price (numeric 10,2) bestond al; de Kaart bewaart hem met
-- dezelfde rechtstreekse update als prijs en naam (RLS + guard_product_commercial_fields).
-- PAS DRAAIEN NA de publish van de admin. Draai eerst 20261101230400 (die maakt de snapshot van
-- 'horeca-kaart' en zet de padteksten om).
--
-- Idempotent: de sectie wordt enkel toegevoegd als ze er nog niet staat.
-- Handmatig terugdraaien:
--   update public.doc_articles set content = replace(content, <de sectie hieronder>, '')
--    where doc_level = 'tenant' and slug = 'horeca-kaart';
--   (of terugzetten uit snapshots.sellqo_20261101_doc_articles_horeca_zijbalk1)

update public.doc_articles
   set content = content || $s$
<h2>Kostprijs en foodcost</h2>
<p>Open een product en vul onder <strong>Kostprijs (excl. btw)</strong> in wat het je kost. Ernaast zie je meteen de <strong>foodcost</strong>: de kostprijs gedeeld door de verkoopprijs zonder btw, met het btw-tarief ter plaatse van dat product. Boven 35 % kleurt het getal rood.</p>
<p>Met de knop <strong>Foodcost</strong> boven de lijst zet je een kolom aan met de foodcost van elk product; een streepje betekent dat er nog geen kostprijs is ingevuld. De knop onthoudt per toestel of de kolom aan staat.</p>
<p>Kostprijs en foodcost zie je enkel met beheerdersrechten; medewerkers aan de kassa en je gasten zien ze niet. Het is dezelfde kostprijs als op het productformulier en in het voorraadrapport.</p>$s$,
       updated_at = now()
 where doc_level = 'tenant'
   and slug = 'horeca-kaart'
   and content not like '%<h2>Kostprijs en foodcost</h2>%';

-- ZIJBALK-BESTELLINGEN-1 — helpartikel horeca-werkplek ("Je horeca-werkplek: wat staat waar").
-- De zijbalk van een horecazaak zonder webshop/events toont Bestellingen enkel nog als online bestellen
-- (afhalen of leveren) aan staat, of als de zaak al bestellingen heeft. Het artikel zei "alle bestellingen,
-- van de kassa, de QR-code aan tafel en online": dat klopt niet (tafel-QR en kassa gaan naar de tafelrekening).
-- Live nagetrokken op 6-11-2026 (read-only): enkel dit artikel beschrijft de horeca-zijbalk met Bestellingen;
-- onderbalk-aanpassen blijft juist (de horeca-only-standaard had al geen Bestellingen).
-- md5 vooraf: horeca-werkplek 0fd9426fc76a3051fb41c5436b4521ca.
-- PAS DRAAIEN NA de publish van sellqo.app met ZIJBALK-BESTELLINGEN-1.
-- Idempotent: de replace() raakt enkel een rij waarin het anker precies één keer voorkomt; na de eerste run is
-- het anker weg, dus een tweede run doet niets. Snapshot vooraf, één keer (create table if not exists).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261106_doc_zijbalk_bestellingen_1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261106_doc_zijbalk_bestellingen_1 as
  select id, doc_level, slug, title, excerpt, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-werkplek';
revoke all on snapshots.sellqo_20261106_doc_zijbalk_bestellingen_1 from anon, authenticated;

update public.doc_articles
   set content = replace(
         content,
         '<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>',
         '<li><strong>Bestellingen</strong>: je online bestellingen om af te halen of te laten leveren. Dit staat enkel in je menu als online bestellen met afhalen of leveren aan staat (<strong>Mijn zaak › Je gasten › Afhalen &amp; leveren</strong>), of als je al bestellingen hebt. Anders vind je het via de zoekbalk (tik "bestellingen"). Wat gasten met de QR-code aan tafel bestellen, komt op de tafelrekening in de kassa.</li>'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'horeca-werkplek'
   and (length(content) - length(replace(content, '<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>', '')))
       = length('<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>');

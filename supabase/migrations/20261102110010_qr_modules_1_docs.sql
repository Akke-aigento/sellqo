-- QR-MODULES-1 — helpartikels volgen de nieuwe plek "QR aan tafel" (Kaart › Instellen › QR-menu).
--   1. "Gasten betalen online aan tafel" (qr-online-betalen): aanzetten gebeurt niet meer onder
--      Kassa › Betalen maar bij QR aan tafel; context_path /admin/pos → /admin/bestellen (daar staat
--      de schakelaar nu). Extra: delen en fooi zijn aparte schakelaars.
--   2. "Bestellingen via de QR op de tafelrekening" (qr-tafelrekening): verwijzing naar Kassa › Betalen
--      wordt QR aan tafel.
--   3. "Oproepen van tafels" (tafel-oproepen): Ober roepen en Rekening vragen hebben elk een schakelaar.
-- Live nagetrokken op 2-11-2026 (read-only): enkel deze drie artikels beschrijven de gast-schakelaars.
-- "Afrekenen op SellQo Kassa" (kassa-afrekenen) noemt Kassa › Betalen voor de kassa-betaalwijzen;
-- dat klopt nog en blijft ongemoeid.
--
-- Idempotent: elke replace() raakt enkel rijen die de oude tekst nog bevatten; de snapshot wordt maar
-- één keer gemaakt (create table if not exists).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, context_path = s.context_path, excerpt = s.excerpt
--     from snapshots.sellqo_20261102_doc_articles_qrmodules1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_doc_articles_qrmodules1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('qr-online-betalen', 'qr-tafelrekening', 'tafel-oproepen');
revoke all on snapshots.sellqo_20261102_doc_articles_qrmodules1 from anon, authenticated;

-- 1. qr-online-betalen
update public.doc_articles
   set content = replace(content,
         'Dat zet je aan onder <strong>Kassa › Betalen</strong>, bij <em>Afrekenen via de QR aan tafel</em>.</p>',
         'Dat zet je aan onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>QR aan tafel</em> › <em>Afrekenen door de gast</em> › <em>De rekening online afrekenen</em>. Daar zet je ook <em>Splitsen toestaan</em> en <em>Fooi aanbieden</em> apart aan of uit. Is een schakelaar grijs, dan staat eronder waarom, met een link die het oplost (bv. <strong>Betalingen</strong> om Stripe te koppelen).</p>'),
       context_path = '/admin/bestellen',
       updated_at = now()
 where doc_level = 'tenant' and slug = 'qr-online-betalen'
   and position('Dat zet je aan onder <strong>Kassa › Betalen</strong>, bij <em>Afrekenen via de QR aan tafel</em>.</p>' in content) > 0;

-- 2. qr-tafelrekening
update public.doc_articles
   set content = replace(content,
         'Dat zet je aan onder <strong>Kassa › Betalen</strong>; lees <strong>Gasten betalen online aan tafel</strong>.</p>',
         'Dat zet je aan onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>Afrekenen door de gast</em>; lees <strong>Gasten betalen online aan tafel</strong>.</p>'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'qr-tafelrekening'
   and position('Dat zet je aan onder <strong>Kassa › Betalen</strong>; lees <strong>Gasten betalen online aan tafel</strong>.</p>' in content) > 0;

-- 3. tafel-oproepen
update public.doc_articles
   set content = replace(content,
         'Dat werkt zodra het QR-menu aanstaat (<strong>Kaart › Instellen › QR-menu</strong>).</p>',
         'Dat werkt zodra het QR-menu op <em>Bestellen aan tafel</em> staat (<strong>Kaart › Instellen › QR-menu</strong>).</p>

<h2>Aan- of uitzetten</h2>
<p>Onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>QR aan tafel</em> › <em>De bediening roepen</em>, zet je <strong>Ober roepen</strong> en <strong>Rekening vragen</strong> elk apart aan of uit. Standaard staan ze allebei aan. Staat een knop uit, dan ziet de gast hem niet meer op het QR-menu of op zijn rekening, en komt er voor die soort geen oproep meer binnen.</p>'),
       excerpt = 'Gasten roepen via de QR-code op hun tafel de bediening of vragen de rekening. Je ziet het op de kassa bij Binnenkomend en tikt op Afgehandeld. Beide knoppen zet je apart aan of uit.',
       updated_at = now()
 where doc_level = 'tenant' and slug = 'tafel-oproepen'
   and position('Dat werkt zodra het QR-menu aanstaat (<strong>Kaart › Instellen › QR-menu</strong>).</p>' in content) > 0;

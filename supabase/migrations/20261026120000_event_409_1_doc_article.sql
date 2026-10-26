-- EVENT-409-1 — helpartikel "Tickets in een bestelling bekijken" (tenant, /admin/orders) bijgewerkt.
-- Twee zinnen erbij, verder niets:
--   1. onder "Tickets opnieuw mailen": bij een geannuleerde of volledig terugbetaalde
--      bestelling staat de knop er niet (en de server weigert het); gedeeltelijk mag wel;
--   2. bij de muntenkaart: de status staat ook in het blok Tickets en munten van de bestelling.
-- Basis = live content van 26-10-2026, md5 vóór 1823f1876e8af4e6e604466bfb918ff6 (= EVENT-COIN-1).
-- Verwachte md5(content) na het draaien: c1e89b3fb41a764b4af084c709319ae2
-- (read-only uitgerekend op de live rij met exact deze replace()-aanroepen).
--
-- PAS DRAAIEN NA de deploy van send-ticket-confirmation én de publish van de admin:
-- anders beschrijft het artikel een knop die nog verschijnt.
--
-- Werkwijze: replace() op de live tekst met een md5-guard, geen gereconstrueerde HTML.
-- Idempotent: na de eerste run klopt de md5-guard niet meer → 0 rijen, niets verandert.
-- Snapshot met IF NOT EXISTS bewaart de rij van vóór de eerste run.
-- Geen vaste updated_at: de trigger update_doc_articles_updated_at zet die op now();
-- verificatie gaat via md5(content).
--
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261026_doc_articles_e409 s
--    where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261026_doc_articles_e409 as
  select * from public.doc_articles
   where doc_level = 'tenant' and slug = 'tickets-in-een-bestelling';
revoke all on snapshots.sellqo_20261026_doc_articles_e409 from anon, authenticated;

update public.doc_articles
   set content = replace(replace(content,
$a$ Er komen geen nieuwe tickets bij: het zijn dezelfde tickets met dezelfde QR-codes.</p>$a$,
$a$ Er komen geen nieuwe tickets bij: het zijn dezelfde tickets met dezelfde QR-codes.</p>
<p>Bij een geannuleerde of volledig terugbetaalde bestelling staat die knop er niet: die tickets gelden niet meer, en SellQo mailt ze dan ook niet opnieuw. Bij een gedeeltelijke terugbetaling kan je de tickets nog wel opnieuw mailen.</p>$a$),
$b$Je ziet de kaart als <strong>Geblokkeerd</strong> onder <strong>Events → Munten</strong>, tabblad <strong>Kaarten</strong>.$b$,
$b$Je ziet de kaart als <strong>Geblokkeerd</strong> onder <strong>Events → Munten</strong>, tabblad <strong>Kaarten</strong>, en ook in het blok <strong>Tickets en munten</strong> van de bestelling zelf: daar staat de status van de muntenkaart naast het saldo (<strong>Actief</strong>, <strong>Geblokkeerd</strong>, <strong>Terugbetaling gevraagd</strong> of <strong>Terugbetaald</strong>).$b$)
 where doc_level = 'tenant'
   and slug = 'tickets-in-een-bestelling'
   and md5(content) = '1823f1876e8af4e6e604466bfb918ff6';

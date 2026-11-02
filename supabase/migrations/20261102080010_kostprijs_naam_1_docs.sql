-- KOSTPRIJS-NAAM-1 — helpartikels noemen products.cost_price voortaan "kostprijs", zoals het
-- productformulier ("Kostprijs (excl. btw)"), de Kaart en het voorraadrapport.
--   1. "Voorraadbeheer" (voorraadbeheer): "Registreer per product de inkoopprijs" → "de kostprijs (excl. btw)".
--   2. "Teamleden en rollen" (teamleden-rollen): "vergelijkingsprijs, inkoopprijs, btw-tarief" → "kostprijs".
-- Live nagetrokken op 2-11-2026 (read-only): dit zijn de enige twee artikels met "inkoopprijs",
-- en beide gaan over products.cost_price. Inkooporders/leveranciers worden niet geraakt.
--
-- Idempotent: replace() vindt na de eerste run niets meer; de WHERE-clausule raakt enkel rijen die
-- de oude tekst nog bevatten (updated_at blijft dan staan); de snapshot wordt maar één keer gemaakt.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261102_doc_articles_kostprijs1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_doc_articles_kostprijs1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('voorraadbeheer', 'teamleden-rollen');
revoke all on snapshots.sellqo_20261102_doc_articles_kostprijs1 from anon, authenticated;

update public.doc_articles
   set content = replace(content,
         'Registreer per product de inkoopprijs — zo tonen',
         'Registreer per product de kostprijs (excl. btw) — zo tonen'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'voorraadbeheer'
   and position('Registreer per product de inkoopprijs — zo tonen' in content) > 0;

update public.doc_articles
   set content = replace(content,
         'vergelijkingsprijs, inkoopprijs, btw-tarief',
         'vergelijkingsprijs, kostprijs, btw-tarief'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'teamleden-rollen'
   and position('vergelijkingsprijs, inkoopprijs, btw-tarief' in content) > 0;

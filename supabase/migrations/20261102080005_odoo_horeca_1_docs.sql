-- ODOO-HORECA-1 — helpartikel "Boekhoudkoppeling met Odoo" (boekhoudkoppeling-odoo): de koppeling zit nu
-- ook in Horeca Big. Live nagetrokken op 2-11-2026: de zin hieronder staat er precies één keer in.
-- PAS DRAAIEN NA 20261102080000_odoo_horeca_1.sql (anders belooft het artikel iets dat het plan nog niet heeft).
--
-- Idempotent: de WHERE-clausule raakt de rij enkel zolang de oude zin er nog in staat; snapshot één keer.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261102_doc_articles_odoo_horeca1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_doc_articles_odoo_horeca1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug = 'boekhoudkoppeling-odoo';
revoke all on snapshots.sellqo_20261102_doc_articles_odoo_horeca1 from anon, authenticated;

update public.doc_articles
   set content = replace(content,
         'Vanaf het Pro-abonnement koppel je je eigen Odoo-boekhouding aan SellQo.',
         'Met Pro of Enterprise (webshop) en met Horeca Big koppel je je eigen Odoo-boekhouding aan SellQo.'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'boekhoudkoppeling-odoo'
   and position('Vanaf het Pro-abonnement koppel je je eigen Odoo-boekhouding aan SellQo.' in content) > 0;

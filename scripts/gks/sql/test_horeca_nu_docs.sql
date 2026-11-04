\set ON_ERROR_STOP 1
-- HORECA-NU-1 — docs-migratie twee keer gedraaid (run.sh): zelfde md5 per artikel, elke vervanging precies één keer.
create or replace function pg_temp.n(slug text, needle text) returns int language sql as $$
  select (length(content) - length(replace(content, needle, ''))) / length(needle) from public.doc_articles where doc_level = 'tenant' and doc_articles.slug = n.slug $$;
select count(*) = 6 as ok_zes_artikels_gemeten from public.horeca_nu_docs_md5 where run = 1;
select not exists (
  select 1 from public.horeca_nu_docs_md5 a join public.horeca_nu_docs_md5 b on b.slug = a.slug and b.run = 2
   where a.run = 1 and a.md5 is distinct from b.md5) as ok_zelfde_md5_na_tweede_run;
select exists (select 1 from public.doc_articles where doc_level = 'tenant' and slug = 'nu-paneel' and is_published and context_path = '/admin/dashboard') as ok_nieuw_artikel;
select pg_temp.n('cockpit-dashboard', '<li><strong>Het Nu-paneel</strong>') = 1 and pg_temp.n('cockpit-dashboard', '<strong>Op voor vandaag</strong>') = 0 as ok_cockpit;
select pg_temp.n('kassa-product-aanpassen', '<strong>⋯ › Nu</strong>') = 1 as ok_kassa_artikel;
select pg_temp.n('keukenscherm-en-tafelbestelling', 'Nu-paneel') = 1 as ok_pauze;
select pg_temp.n('zaalplan-en-qr-per-tafel', 'Een ruimte tijdelijk dicht') = 1 and pg_temp.n('zaalplan-en-qr-per-tafel', '<h2>Een tafel of ruimte verwijderen</h2>') = 1 as ok_zaalplan;
select pg_temp.n('zaal-live-overzicht', 'tijdelijk dicht zette') = 1 as ok_zaal_live;
-- Eerlijk: geen belofte over vroeger sluiten of over reserveren per zone.
select position('Vroeger sluiten (een ander sluitingsuur voor vandaag) kan hier nog niet' in content) > 0
   and position('gasten kiezen daar geen ruimte' in content) > 0 as ok_eerlijk
  from public.doc_articles where doc_level = 'tenant' and slug = 'nu-paneel';
select 'HORECA-NU-1 docs: alle controles gedraaid' as klaar;

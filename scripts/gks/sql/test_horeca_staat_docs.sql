\set ON_ERROR_STOP 1
-- HORECA-STAAT-1 — docs-migratie twee keer gedraaid (run.sh): zelfde md5 per artikel, elke vervanging precies één
-- keer, de oude (nu foute) zinnen weg.
create or replace function pg_temp.n(slug text, needle text) returns int language sql as $$
  select (length(content) - length(replace(content, needle, ''))) / length(needle) from public.doc_articles where doc_level = 'tenant' and doc_articles.slug = n.slug $$;
select count(*) = 4 as ok_vier_artikels_gemeten from public.horeca_staat_docs_md5 where run = 1;
select not exists (
  select 1 from public.horeca_staat_docs_md5 a join public.horeca_staat_docs_md5 b on b.slug = a.slug and b.run = 2
   where a.run = 1 and a.md5 is distinct from b.md5) as ok_zelfde_md5_na_tweede_run;
select not exists (select 1 from public.horeca_staat_docs_md5 a join public.horeca_staat_docs_md5_voor v on v.slug = a.slug where a.run = 1 and a.md5 = v.md5) as ok_elk_artikel_gewijzigd;
select pg_temp.n('nu-paneel', 'neemt de keuken even niets aan') = 1 and pg_temp.n('nu-paneel', 'Bestellen aan tafel blijft werken.') = 0 as ok_nu_pauze;
select pg_temp.n('nu-paneel', '<strong>Toch open vandaag</strong>') = 1 and pg_temp.n('nu-paneel', 'Bestellen via de QR aan tafel blijft wel mogelijk') = 0 as ok_nu_dicht;
select pg_temp.n('keukenscherm-en-tafelbestelling', 'Zonder bereidingsposten ligt ook bestellen aan tafel stil.') = 1
   and pg_temp.n('keukenscherm-en-tafelbestelling', 'bestellen aan tafel blijft werken') = 0 as ok_keuken_pauze;
select pg_temp.n('keukenscherm-en-tafelbestelling', 'Tijdens een keukenpauze staat de <strong>+</strong>') = 1 as ok_keuken_tafel;
select pg_temp.n('openingsuren-instellen', 'niet via de QR-code aan tafel, en online reserveren voor die dag ook niet') = 1
   and pg_temp.n('openingsuren-instellen', 'Bestellen aan tafel via de QR-code blijft werken') = 0 as ok_uren_sluiting;
select pg_temp.n('openingsuren-instellen', 'ook zonder weekuren: bovenaan en in de voettekst') = 1 as ok_uren_zonder_week;
select pg_temp.n('qr-tafelrekening', 'Afrekenen blijft gewoon kunnen.') = 1 as ok_qr;
select exists (select 1 from snapshots.sellqo_20261104_doc_horeca_staat_1 where slug = 'nu-paneel' and position('Bestellen aan tafel blijft werken.' in content) > 0) as ok_snapshot_van_voor;
select 'HORECA-STAAT-1 docs: alle controles gedraaid' as klaar;

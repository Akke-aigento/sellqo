\set ON_ERROR_STOP 1
-- UREN-1c — docs-migraties van UREN-1/1b twee keer gedraaid (run.sh): zelfde md5 per artikel, en elke
-- vervanging precies één keer.
select count(*) = 6 as ok_zes_artikels_gemeten from public.uren_docs_md5 where run = 1;
select not exists (
  select 1 from public.uren_docs_md5 a join public.uren_docs_md5 b on b.slug = a.slug and b.run = 2
   where a.run = 1 and a.md5 is distinct from b.md5) as ok_zelfde_md5_na_tweede_run;
select (select (length(content) - length(replace(content, '<li><strong>Website</strong>:', ''))) / length('<li><strong>Website</strong>:')
          from public.doc_articles where slug = 'horeca-werkplek') = 1 as ok_website_regel_een_keer;
select (select (length(content) - length(replace(content, '<li><strong>Betalingen</strong>,', ''))) / length('<li><strong>Betalingen</strong>,')
          from public.doc_articles where slug = 'horeca-werkplek') = 1 as ok_betalingen_regel_een_keer;
select (select (length(content) - length(replace(content, 'Horecathema', ''))) / length('Horecathema')
          from public.doc_articles where slug = 'theme-aanpassen') = 1 as ok_horecathemas_een_keer;
select (select (length(content) - length(replace(content, 'Openingsuren en contact', ''))) / length('Openingsuren en contact')
          from public.doc_articles where slug = 'theme-aanpassen') = 1 as ok_openingsuren_sectie_een_keer;
select (select position('Zelfde als openingsuren' in content) > 0 from public.doc_articles where slug = 'reservaties') as ok_reservaties_bijgewerkt;
select (select position('de enige plek voor je logo' in content) > 0 from public.doc_articles where slug = 'emailcampagnes') as ok_emailcampagnes_bijgewerkt;
select position('domein' in (select string_agg(content, ' ') from public.doc_articles where slug in ('openingsuren-instellen', 'horeca-werkplek'))) = 0 as ok_geen_domeinbelofte_horeca;
select 'UREN-1c docs: alle controles gedraaid' as klaar;

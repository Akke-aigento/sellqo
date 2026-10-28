-- PRINT-2b — helpartikel bon-en-printers: printer voor bonnen zonder post.
-- PAS DRAAIEN NA 20261029010000_print_2b.sql, de deploy van horeca-print (PRINT-2b) en de publish van de admin.
-- md5-guard: enkel bijwerken als het artikel nog de PRINT-2-versie is; al bijgewerkt = overslaan.
-- Handmatig terugdraaien: de alinea "Geen posten?" weghalen (of de inhoud uit 20261028231000_print_2_docs.sql terugzetten).
do $doc$
declare
  d text;
  a text := 'Eén printer mag meerdere posten bedienen. De posten zelf maak je in <strong>Bestellen › Posten</strong>.</p>';
  b text := 'Eén printer mag meerdere posten bedienen. De posten zelf maak je in <strong>Bestellen › Posten</strong>.</p>
<p><strong>Geen posten?</strong> Kies dan een printer bij <em>Bonnen zonder post</em>: alle keukenbonnen komen daar uit. Heb je wel posten maar geen standaardpost, dan gaan bonnen die bij geen post horen naar die printer.</p>';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'bon-en-printers';
  if d is null then raise notice 'PRINT-2b docs: artikel ontbreekt, overgeslagen'; return; end if;
  if position('Bonnen zonder post' in d) > 0 then raise notice 'PRINT-2b docs: al bijgewerkt'; return; end if;
  if md5(d) <> '2681e7a93a58c213051f5204fe0c41fe' then raise exception 'PRINT-2b docs: artikel wijkt af (md5 %), niet bijgewerkt', md5(d); end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'PRINT-2b docs: ankertekst niet precies één keer gevonden'; end if;
  update public.doc_articles set content = replace(d, a, b), updated_at = now() where doc_level = 'tenant' and slug = 'bon-en-printers';
end
$doc$;

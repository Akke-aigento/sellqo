-- KAART-LOOK-1 — helpartikel "horeca-kaart" volgt de nieuwe rij: knopjes "Op de kaart" en
-- "Beschikbaar"/"Op", de knop "Producten toevoegen", en Selecteren en Volgorde als modus.
-- md5-guard 835fff48134cea998a1de23ddb640e40; elke vervanging moet precies één keer raken.
-- PAS DRAAIEN NA de publish van de admin. Idempotent: al bijgewerkt → overgeslagen.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261028_doc_articles_kaartlook1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261028_doc_articles_kaartlook1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-kaart';
revoke all on snapshots.sellqo_20261028_doc_articles_kaartlook1 from anon, authenticated;

do $doc$
declare
  d text;
  n text;
  pairs text[] := array[
$a$  <li><strong>Schakelaar</strong>: het product op de kaart zetten of eraf halen.</li>
  <li><strong>Op voor vandaag</strong> (het rondje met de streep): het product is overal uitverkocht tot morgenvroeg 5 uur.</li>$a$,
$a$  <li><strong>Op de kaart</strong> / <strong>Niet op de kaart</strong>: tik op het knopje om het product op de kaart te zetten of eraf te halen.</li>
  <li><strong>Beschikbaar</strong> / <strong>Op · terugzetten</strong>: tik op <em>Beschikbaar</em> en het product is overal uitverkocht tot morgenvroeg 5 uur (het knopje wordt rood). Tik nog eens om het terug te zetten.</li>$a$,
$a$<p>Sleep een product aan het greepje links (de zes puntjes) naar boven of beneden binnen zijn categorie. Categorieën sleep je aan het greepje in hun kop.$a$,
$a$<p>Tik bovenaan op de knop <strong>Volgorde</strong> (de twee pijltjes). Dan verschijnt links een greepje (zes puntjes): sleep een product naar boven of beneden binnen zijn categorie, of een categorie aan het greepje in haar kop. Tik op het vinkje als je klaar bent.$a$,
$a$  <li><strong>Selecteren</strong>: vink producten aan (of alles in een categorie).$a$,
$a$  <li><strong>Selecteren</strong> (bovenaan): vink producten aan (of alles in een categorie). Tik op <em>Klaar</em> als je klaar bent.$a$,
$a$<h2>Veel tegelijk</h2>$a$,
$a$<h2>Veel tegelijk</h2>
<p>Lijst plakken, de startkaart en een foto van je kaart vind je onder de knop <strong>Producten toevoegen</strong>.</p>$a$
  ];
  i integer;
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-kaart';
  if d is null then raise exception 'KAART-LOOK-1: artikel horeca-kaart niet gevonden'; end if;
  if position('Op · terugzetten' in d) > 0 then
    raise notice 'KAART-LOOK-1: horeca-kaart al bijgewerkt, overgeslagen';
    return;
  end if;
  if md5(d) <> '835fff48134cea998a1de23ddb640e40' then
    raise exception 'KAART-LOOK-1: horeca-kaart wijkt af (md5 %), niet bijgewerkt', md5(d);
  end if;
  n := d;
  for i in 1 .. array_length(pairs, 1) / 2 loop
    if (length(n) - length(replace(n, pairs[2 * i - 1], ''))) / length(pairs[2 * i - 1]) <> 1 then
      raise exception 'KAART-LOOK-1: vervanging % raakt niet precies één keer', i;
    end if;
    n := replace(n, pairs[2 * i - 1], pairs[2 * i]);
  end loop;
  update public.doc_articles set content = n, updated_at = now() where doc_level = 'tenant' and slug = 'horeca-kaart';
end
$doc$;

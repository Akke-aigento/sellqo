# MEDIA-1 + PHOTO-STD-1 + EDITOR-2 — deployrecept

Alles staat op de branch `media-1`. Geen edge function geraakt: geen edge-deploy nodig.
Volgorde is belangrijk; elke stap heeft zijn eigen natrek.

## 0. Vooraf

- Akke's go voor merge naar `main`.
- `gh run list --limit 1` na de push: CI groen (typecheck, lint, i18n-pariteit, build).

## 1. Migratie MEDIA-1 — één bibliotheek

`supabase/migrations/20261016190000_media_1_one_library.sql` in **één eigen** `query_database`-aanroep
(nooit samen met een `begin … rollback`-test: die draait alles terug).

Natrek (aparte aanroep):

```sql
select (select count(*) from pg_indexes where indexname = 'media_assets_tenant_url_uniq') as idx,
       (select count(*) from pg_trigger where tgname like 'trg_%media_register') as triggers,
       (select json_agg(x) from (select source, count(*) n from media_assets group by 1 order by 1) x) as per_source;
```

Verwacht: `idx = 1`, `triggers = 3`, en rijen voor `product` (~451), `variant` (~36), `category` (~13)
naast de bestaande `upload`/`nano_studio` (droogloop 16-10: 451 / 36 / 13 bij 20 tenants).

## 2. Migratie PHOTO-STD-1 — fotostandaard

`supabase/migrations/20261016191000_photo_std_1_tenant_media_settings.sql` in een eigen aanroep.

Natrek: `select count(*) from pg_policies where tablename = 'tenant_media_settings';` → 4.
RLS-proef (aparte aanroep, eindigt met `raise exception` zodat er niets blijft): vreemde gebruiker
insert → 42501, ziet 0 rijen; platform-admin insert → ok; achtergrond `'rood'` → 23514.
(Droogloop 16-10: precies zo.)

## 3. Helpartikel

`supabase/migrations/20261016192000_media_1_doc_article.sql`.
Natrek: `select md5(content) from doc_articles where doc_level = 'tenant' and slug = 'productfotos-mediabibliotheek-fotostandaard';`
en vergelijk met `md5` van de `$doc$`-tekst in het migratiebestand.

## 4. Publish sellqo.app

`deploy_project` (sellqo.app is Lovable-hosted). Vingerafdruk: `net.http_get` op de index → nieuwe
`/assets/index-*.js` → zoek de string `tenant_media_settings` in die bundel (of in een lazy chunk
van de productpagina). De native apps krijgen het pas met de volgende build.

## 5. Na de deploy (apart akkoord nodig)

- **Mancini**: fotostandaard aanzetten (3:4, 1200 px, achtergrond zwart, marge 8%) — kan Mancini zelf
  onder Producten → Foto's, of via SQL na go. Daarna de Shopify-foto's naar eigen opslag halen
  (Marketing → AI Content Hub → Assets → gele melding). 87 foto's, waarvan 9 op actieve producten.
- **VanXcel**: 130 Shopify-foto's (127 actief). NIET zonder Akke's go: VanXcel draait de bol.com-koppeling.
  De bol-functies lezen `products.images` niet (grep 16-10), maar Akke beslist.
- Mancini-frontend: Trending Now en Tracksuits op `object-contain` zoals de collecties (afspraak
  14-04-2026). Losse agent-batch op project 2c89fac8 + `deploy_project`.

## Terugdraaien

Zie de kop van elk migratiebestand. Frontend: revert van de merge-commit; de code werkt ook zonder de
migraties (registreren valt terug op select + insert, instellingen tonen "uit").

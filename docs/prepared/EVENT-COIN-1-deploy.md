# EVENT-COIN-1 — deploy

Twee migraties, geen edge function, geen publish, geen native build. Het gedrag zit volledig
in de database (trigger-functie `trg_orders_cancel_tickets`). Pas uitvoeren na Akke's go.

Alles via `query_database` op sellqo (9932a7fe-43a1-42de-9c64-168968599600), **elke stap in een
eigen aanroep** (`query_database` voert één aanroep als één transactie uit; een test of
`rollback` in dezelfde aanroep draait de migratie mee terug).

## Volgorde ten opzichte van zaterdag 24-10 (Fonske Crawl)

- Draaien **vóór vrijdag 23-10 20:00**, zodat er nog een dag is om terug te draaien als iets
  vreemd doet. Niet op de dag zelf, niet tijdens de crawl.
- Fonske verkoopt vandaag geen munten (0 muntproducten, 0 `token_settings`, 0 kaarten,
  gemeten 16-10). De wijziging raakt Fonske dus pas als daar munten verkocht worden; tickets
  gedragen zich exact als nu (ticketblok byte-identiek aan FONSKE-READY-1).
- Onafhankelijk van de EVENT-ORDER-1-edge-deploy: de trigger vuurt op elke overgang naar
  `cancelled`/`refunded`, langs welk pad ook.

## Stap 0 — nulmeting (read-only)

```sql
select md5(pg_get_functiondef('public.trg_orders_cancel_tickets()'::regprocedure)) as fn_md5,
       (select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_orders_cancel_tickets') as trg,
       (select count(*) from information_schema.tables where table_schema = 'ops' and table_name = 'event_coin_1_prev_functions') as snap,
       (select count(*) from token_wallets w join orders o on o.id = w.order_id
         where w.status = 'active' and (o.status::text = 'cancelled' or o.payment_status::text = 'refunded')) as open_gevallen;
```
Verwacht: `fn_md5 = 9f53c1e2699ea6b01e867b6342519345` (FONSKE-READY-1), trigger met de WHEN op
`cancelled`/`refunded`, `snap = 0`, `open_gevallen = 0` (16-10). Wijkt `fn_md5` af: STOP, iemand heeft
de functie intussen gewijzigd; eerst uitzoeken.

## Stap 1 — functie-migratie (eigen aanroep)

Inhoud van `supabase/migrations/20261016180000_event_coin_1.sql`, volledig, niets erbij.

## Stap 2 — natrek (eigen aanroep, read-only)

```sql
select md5(pg_get_functiondef('public.trg_orders_cancel_tickets()'::regprocedure)) as fn_md5,
       (select md5(definition) from ops.event_coin_1_prev_functions where proname = 'trg_orders_cancel_tickets') as snapshot_md5,
       (select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_orders_cancel_tickets') as trg,
       position('token_wallets' in pg_get_functiondef('public.trg_orders_cancel_tickets()'::regprocedure)) > 0 as heeft_munten;
```
Verwacht: `fn_md5 = 9b8348ecea58baca5f2c095fbea314fb` (gemeten in de rollbacktest van 16-10),
`snapshot_md5 = 9f53c1e2699ea6b01e867b6342519345`, trigger ongewijzigd t.o.v. stap 0,
`heeft_munten = true`. Pas dan verder.

Optioneel: de rollbacktest van de role-audit (EVENT-COIN-1, Verificatie) nog eens draaien,
nu **zonder** de `create or replace` erin. Die eindigt met `raise exception`, dus er blijft niets staan.

## Stap 3 — helpartikel (eigen aanroep)

Inhoud van `supabase/migrations/20261016181000_event_coin_1_doc_article.sql`. Neemt zelf de
snapshot `snapshots.sellqo_20261016_doc_articles_ec1` (IF NOT EXISTS).

## Stap 4 — natrek artikel (eigen aanroep)

```sql
select md5(content) as nu,
       (select md5(content) from snapshots.sellqo_20261016_doc_articles_ec1) as snapshot
from doc_articles where doc_level = 'tenant' and slug = 'tickets-in-een-bestelling';
```
Verwacht: `nu = 1823f1876e8af4e6e604466bfb918ff6`, `snapshot = e02e6a545e71d11f4d988af56ba0ce0f`.
(Niet op `updated_at` controleren: de trigger zet die op `now()`.)

## Stap 5 — nieuwsbrief

Item 2026.12i in `docs/newsletter-queue.md` mag dan mee in de bundel met 2026.12b/12d.

## Terugdraaien

```sql
-- functie terug naar FONSKE-READY-1 (eigen aanroep):
select definition from ops.event_coin_1_prev_functions where proname = 'trg_orders_cancel_tickets';
-- → die tekst uitvoeren; daarna fn_md5 = 9f53c1e2699ea6b01e867b6342519345 natrekken.

-- artikel terug:
update public.doc_articles d set content = s.content, tags = s.tags
  from snapshots.sellqo_20261016_doc_articles_ec1 s where d.id = s.id;
```
Kaarten die intussen automatisch geblokkeerd werden, blijven geblokkeerd. Vrijgeven per kaart
via **Events → Munten → Kaarten → Vrijgeven**.

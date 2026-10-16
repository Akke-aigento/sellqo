# EVENT-ORDER-1 — deploy

Commit `2f64fcd`, samengevoegd in branch `night-final` (samen met EDGE-PIN-1: storefront-api en update-order-fulfillment-status importeren supabase-js nu vast op 2.57.2).
Pas uitvoeren na Akke's go, en NA de merge naar `main` (Lovable volgt main).

## Deploylijst (bepaald met grep, niet uit het hoofd)

| Functie | Waarom | Vingerafdruk (GET, neveneffectvrij) |
|---|---|---|
| `update-order-fulfillment-status` | index.ts gewijzigd + nieuwe `_shared/emailOnlyOrder.ts` | vóór: HTTP 405 `{"success":false,"error":"Method not allowed"}` → na: HTTP 200 `{"ok":true,"version":"EVENT-ORDER-1"}` |
| `storefront-api` | index.ts gewijzigd (gratis pad + GET-stempel) | vóór: `{"ok":true,"version":"DISCOUNT-LIMIT-1"}` → na: `{"ok":true,"version":"EVENT-ORDER-1"}` |

`grep -rl "_shared/emailOnlyOrder" supabase/functions` → alleen `update-order-fulfillment-status/index.ts`.
Geen andere `_shared`-bestanden gewijzigd. Geen andere functies.

Daarnaast (geen edge function):
- Admin-frontend publiceren: `deploy_project` op sellqo (9932a7fe-43a1-42de-9c64-168968599600). Verifiëren: index → nieuwe `/assets/index-*.js` → zoek `order-email-only` in de bundel.
- Doc-migratie `supabase/migrations/20261016120000_event_order_1_doc_article.sql` pas NA de edge-deploy (het artikel belooft de nieuwe overgang). Na: `select md5(content) from doc_articles where slug='tickets-in-een-bestelling' and doc_level='tenant'` = `e02e6a545e71d11f4d988af56ba0ce0f`.

## Nulmeting (vóór de deploy, via query_database — aparte aanroepen)

```sql
select net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/update-order-fulfillment-status') as a,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/storefront-api') as b,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/bestaat-niet-eo1') as c;
-- enkele seconden later:
select id, status_code, content from net._http_response where id in (<a>, <b>, <c>);
```
Verwacht: a = 405, b = DISCOUNT-LIMIT-1, c = NOT_FOUND (controle). Blijft het leeg: `select count(*) from net.http_request_queue;` en `select net.wake();`.

## Prompt voor de Lovable-agent (send_message, project 9932a7fe-43a1-42de-9c64-168968599600)

```
DEPLOY-ONLY — EVENT-ORDER-1. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie. Controleer dat:
  a) supabase/functions/update-order-fulfillment-status/index.ts de regel
     const VERSION = "EVENT-ORDER-1";
     bevat én importeert uit "../_shared/emailOnlyOrder.ts";
  b) supabase/functions/_shared/emailOnlyOrder.ts bestaat en de functie isEmailOnlyOrder exporteert;
  c) supabase/functions/storefront-api/index.ts de tekst version: 'EVENT-ORDER-1' bevat
     en de functie runAfterResponse bevat.
Klopt één ervan niet: meld welke en STOP.

Stap 2 — deploy exact deze twee edge functions, niets anders:
  - update-order-fulfillment-status
  - storefront-api

Stap 3 — meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt stap X niet, meld dat en STOP — maak geen enkele code- of configwijziging, ook geen build- of testfixes.
Draai geen migraties. Roep de functies niet zelf aan. Commit niets.
Beide functies importeren supabase-js vast op 2.57.2 (EDGE-PIN-1). Faalt de deploy toch op
"Module not found" van esm.sh, meld dat letterlijk en STOP — niets zelf repareren.
```

Geeft send_message na ~230 s een MCP-timeout: NIET opnieuw sturen. Eerst `git ls-remote origin main` (agent-commits? die mogen er niet zijn) en dan de vingerafdruk meten.

## Nameting (na de deploy)

1. Zelfde drie `net.http_get` als de nulmeting. Verwacht: a = 200 `{"ok":true,"version":"EVENT-ORDER-1"}`, b = `{"ok":true,"version":"EVENT-ORDER-1"}`, c = NOT_FOUND.
   Pas bij beide nieuwe stempels is de deploy bewezen; het "gedeployed"-rapport van de agent is geen bewijs.
2. `git log origin/main -3`: geen onverwachte agent-commits (alles buiten `src/integrations/` = stoppen en uitzoeken). CC pullt daarna.
3. Storefront-cart nameting tegen een nulmeting (R10/G6): vóór de deploy `cart_get` op 2-3 live carts (bv. via een ops-snapshot), na de deploy opnieuw → identiek.
4. Functioneel (Speeltuin, NACHTTEST-data): één gratis checkout timen (respons < 2 s), daarna factuur + `ticket_mail_log` + order op `delivered` natrekken; die order via de dropdown op Geannuleerd zetten → `ticket_instances` = `cancelled`; een fysieke order op Afgeleverd → Geannuleerd moet 422 blijven geven.
5. `gh run list --limit 1` na de push tot CI groen staat.

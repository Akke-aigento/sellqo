# EVENT-409-1 — deploy

Code op branch `event-409-1` (lokaal gecommit, nog niet gepusht). Pas uitvoeren na Akke's go,
NA de merge naar `main` (Lovable volgt main) en nadat de CI-run op `main` groen is
(`gh run list --limit 1`). Op 26-10 zijn deploys geblokkeerd door Lovable-credits (zie KAART-5).

## Deploylijst (bepaald met grep, niet uit het hoofd)

| Wat | Waarom | Vingerafdruk (neveneffectvrij) |
|---|---|---|
| edge `storefront-api` | `index.ts` (409 + GET-stempel) + nieuw `_shared/storefrontErrorStatus.ts` | GET vóór: `{"ok":true,"version":"CART-TENANT-1"}` → na: `{"ok":true,"version":"EVENT-409-1"}` |
| edge `send-ticket-confirmation` | `index.ts` (weigering ORDER_CLOSED + GET-stempel) | GET vóór: `{"ok":true,"version":"EVENT-DONE-1"}` → na: `{"ok":true,"version":"EVENT-409-1"}` |
| admin publiceren (`deploy_project` op sellqo) | `OrderTicketsCard`, `EventTokens`, i18n, changelog 2026.13w | index → nieuwe `/assets/index-*.js` → zoek `ORDER_CLOSED` en `order_tickets_status_resend` in de bundel |
| migratie `supabase/migrations/20261026120000_event_409_1_doc_article.sql` | helpartikel `tickets-in-een-bestelling` | `md5(content)` vóór `1823f1876e8af4e6e604466bfb918ff6` → na `c1e89b3fb41a764b4af084c709319ae2` |
| native build (iOS + Android) | de admin zit in de Capacitor-app (gebundelde code) | buildnummer = max(TestFlight, Play Console) + 1; in de role-audit noteren |

`grep -rl "_shared/storefrontErrorStatus" supabase/functions` → alleen `storefront-api/index.ts`.
Geen bestaand `_shared`-bestand gewijzigd, dus geen andere functies.

**Let op: de `storefront-api`-deploy neemt KAART-5 mee** (`7dca0e8`, `sort_by: 'menu'`, nog niet live
door het credittekort van 25-10). Doe daarom ook de KAART-5-nameting uit de role-audit
(`snapshots.kaart5_probe`, fase `na`: De Wissel "Wit bier, Pils, Tripel van 't vat"; VanXcel en
Mancini identieke md5). Verder zit er sinds de laatste storefront-api-deploy (LIVEGANG horeca,
24-10) niets anders in: `git log --oneline 6d8881b..HEAD -- supabase/functions/storefront-api`
geeft enkel `7dca0e8` en deze batch.

## Volgorde

1. Nulmeting (hieronder).
2. Deploy van de twee edge functions (Lovable-agent, prompt hieronder).
3. Nameting edge (stempels + controle) en de KAART-5-nameting.
4. Admin publiceren (`deploy_project`), bundel nakijken.
5. Doc-migratie in een eigen `query_database`-aanroep, daarna natrek in een aparte aanroep.
6. Native build.
7. Nieuwsbrief-item 2026.13w op "klaar voor verzending" zetten.

Waarom edge vóór publish: de UI verbergt de knop al zelf; de server is het vangnet. Andersom
(eerst publish) is ook veilig, maar dan beschrijft niets nog de serverweigering. Het artikel
komt als laatste, zodat het nooit iets belooft wat nog niet live staat.

## Stap 1 — nulmeting (query_database, aparte aanroepen)

```sql
select net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/storefront-api') as a,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/send-ticket-confirmation') as b,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/bestaat-niet-e409') as c;
-- enkele seconden later:
select id, status_code, content from net._http_response where id in (<a>, <b>, <c>);
```
Verwacht: a = `CART-TENANT-1`, b = `EVENT-DONE-1`, c = `NOT_FOUND` (controle).
Blijft het leeg: `select count(*) from net.http_request_queue;` en `select net.wake();`.
Wijkt a of b af van de verwachting: STOP, iemand heeft intussen gedeployed; eerst uitzoeken.

Artikel:
```sql
select md5(content) from doc_articles where doc_level = 'tenant' and slug = 'tickets-in-een-bestelling';
```
Verwacht `1823f1876e8af4e6e604466bfb918ff6`. Anders: STOP (de migratie doet dan niets door de md5-guard).

## Stap 2 — prompt voor de Lovable-agent (send_message, project 9932a7fe-43a1-42de-9c64-168968599600)

```
DEPLOY-ONLY — EVENT-409-1. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie. Controleer dat:
  a) supabase/functions/storefront-api/index.ts de tekst version: 'EVENT-409-1' bevat
     én importeert uit "../_shared/storefrontErrorStatus.ts";
  b) supabase/functions/_shared/storefrontErrorStatus.ts bestaat en statusForStorefrontError exporteert;
  c) supabase/functions/send-ticket-confirmation/index.ts de tekst version: "EVENT-409-1"
     en de foutcode "ORDER_CLOSED" bevat.
Klopt één ervan niet: meld welke en STOP.

Stap 2 — deploy exact deze twee edge functions, niets anders:
  - storefront-api
  - send-ticket-confirmation

Stap 3 — meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt stap X niet, meld dat en STOP — maak geen enkele code- of configwijziging, ook geen build- of testfixes.
Draai geen migraties. Roep de functies niet zelf aan. Commit niets.
Beide functies importeren supabase-js vast op 2.57.2. Faalt de deploy toch op
"Module not found" van esm.sh, meld dat letterlijk en STOP — niets zelf repareren.
```

Geeft `send_message` na ~230 s een MCP-timeout: NIET opnieuw sturen. Eerst de diff-check (hieronder)
en dan de vingerafdruk meten.

## Stap 3 — diff-check en nameting

Diff-check (na de agent-run, vóór je iets anders doet):
- `git ls-remote origin main` → moet nog altijd de hash zijn die je zelf naar `main` duwde. Een
  nieuwe agent-commit = de agent heeft iets gewijzigd: stoppen en `get_diff` op die message
  bekijken. Alleen `src/integrations/supabase/*` (platformbestanden) mag; al de rest terugdraaien.
- `list_messages`: de deploy-tijdstempel ligt ná de merge-commit.

Nameting (dezelfde drie `net.http_get` als stap 1): a = `EVENT-409-1`, b = `EVENT-409-1`, c = `NOT_FOUND`.
Pas dan is de deploy bewezen. Een "gedeployed"-melding van de agent is geen bewijs.

Geen POST-proef op de live functies: `cart_add_item` volzet vraagt een volzet event (er is er geen),
en `send-ticket-confirmation` mailt klanten. Het gedrag is bewezen in de tests
(`scripts/promo-compare/event409.test.ts`, `scripts/promo-compare/ticketResend.test.ts`, beide in CI)
tegen de echte handler; de stempel bewijst dat precies die code live staat.

Daarna de KAART-5-nameting (zie hierboven) en een gewone leesproef op een custom frontend:
`get_products` voor VanXcel geeft 200 met dezelfde md5 als de KAART-5-nulmeting.

## Stap 4 — admin publiceren

`deploy_project` op sellqo. Verifiëren: `net.http_get` op `https://sellqo.app/?v=<epoch>` → nieuwe
`/assets/index-*.js` → in die bundel `ORDER_CLOSED` en `order_tickets_status_resend` terugvinden.
Daarna in een testzaak (Zomerfest Leuven, demo) een bestelling met muntenkaart openen: badge zichtbaar;
een geannuleerde bestelling: geen knop **Tickets opnieuw mailen**.

## Stap 5 — doc-migratie (eigen aanroep), dan natrek (aparte aanroep)

Inhoud van `supabase/migrations/20261026120000_event_409_1_doc_article.sql`, volledig, niets erbij.

```sql
select md5(content) as nu,
       (select md5(content) from snapshots.sellqo_20261026_doc_articles_e409) as snapshot
from doc_articles where doc_level = 'tenant' and slug = 'tickets-in-een-bestelling';
```
Verwacht: `nu = c1e89b3fb41a764b4af084c709319ae2`, `snapshot = 1823f1876e8af4e6e604466bfb918ff6`
(op 26-10 nagerekend in een rollbacktest, ook twee keer na elkaar). Niet op `updated_at` controleren.

## Terugdraaien

- Edge: de vorige versie opnieuw deployen vanaf de commit vóór EVENT-409-1 (`2a1dfdf`). Let op:
  dat haalt ook KAART-5 weer weg tenzij je enkel deze batch revert (`git revert <hash>`).
- Admin: revert + publish.
- Artikel:
  ```sql
  update public.doc_articles d set content = s.content
    from snapshots.sellqo_20261026_doc_articles_e409 s where d.id = s.id;
  ```

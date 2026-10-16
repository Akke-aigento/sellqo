# SUB-UNIFY-2A — deploy

Branch `sub-cancel-1` (commit: zie de role-audit). Pas uitvoeren na Akke's go en NA de merge naar `main` (Lovable volgt main). **Facturatiezone:** elke stap apart meten, niets samenvoegen.

Volgorde: (1) edge functions → (2) frontend-publish → (3) doc_articles-migratie → (4) cron in dry-run → (5) minstens één dry-run nakijken → (6) APARTE go: sweep op echte modus. Stap 6 is een eigen beslissing van Akke.

## Deploylijst (bepaald met grep, niet uit het hoofd)

| Functie | Waarom | Vingerafdruk (GET, neveneffectvrij) |
|---|---|---|
| `sync-tenant-plan` | opzeggen/Free op het einde van de periode, intrekken via switch, end_date wissen bij activate | vóór: 200 `{"ok":true,"version":"PRICE-2"}` → na: 200 `{"ok":true,"version":"SUB-UNIFY-2A"}` |
| `subscription-lifecycle-sweep` (nieuw) | dagelijkse overgang naar Free, standaard dry-run | vóór: 404 `NOT_FOUND` → na: 200 `{"ok":true,"version":"SUB-UNIFY-2A"}` |
| `create-notification` | importeert `_shared/notificationDefaults.ts` (nieuwe default `subscriptions/plan_ended`) | vóór: 500 `{"error":"Unexpected end of JSON input"}` → na: 200 `{"ok":true,"version":"SUB-UNIFY-2A"}` |
| `send-push-notification` | idem | vóór: 401 `{"error":"Unauthorized internal call"}` → na: 200 `{"ok":true,"version":"SUB-UNIFY-2A"}` |

- `grep -rl "_shared/planLifecycle" supabase/functions` → `sync-tenant-plan/index.ts`, `subscription-lifecycle-sweep/index.ts` (+ het testbestand). Nieuw bestand.
- `grep -rl "notificationDefaults" supabase/functions` → `create-notification/index.ts`, `send-push-notification/index.ts`. Geen ander `_shared`-bestand importeert het.
- **Niet** gewijzigd en niet deployen: `generate-subscription-invoices` (de end_date-guard bestaat al, r. ~419-430), `check-expired-trials`, `sync-billing-state`, `get-platform-billing-status`, `platform-gift-month`, `storefront-*`.

## Nulmeting (gemeten 16-10-2026, vóór de deploy)

Met de publieke anon-key (`VITE_SUPABASE_PUBLISHABLE_KEY` uit `.env`), want `verify_jwt` staat standaard aan:

```sql
with h as (select jsonb_build_object('Authorization','Bearer <ANON_KEY>','apikey','<ANON_KEY>') as hd)
select net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sync-tenant-plan', headers := hd) a,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/subscription-lifecycle-sweep', headers := hd) b,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/create-notification', headers := hd) c,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/send-push-notification', headers := hd) d,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/bestaat-niet-su2a', headers := hd) e
from h;
-- enkele seconden later, aparte aanroep:
select id, status_code, content from net._http_response where id in (<a>,<b>,<c>,<d>,<e>) order by id;
```

Uitkomst nulmeting (ids 261083-261087): a = 200 `PRICE-2`, b = 404 `NOT_FOUND`, c = 500 `Unexpected end of JSON input`, d = 401 `Unauthorized internal call`, e = 404 `NOT_FOUND` (controle).
Blijft het leeg: `select count(*) from net.http_request_queue;` en `select net.wake();`.

## Stap 1 — prompt voor de Lovable-agent (send_message, project 9932a7fe-43a1-42de-9c64-168968599600)

```
DEPLOY-ONLY — SUB-UNIFY-2A. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie. Controleer dat:
  a) supabase/functions/sync-tenant-plan/index.ts de tekst
     version: "SUB-UNIFY-2A"
     bevat én importeert uit "../_shared/planLifecycle.ts";
  b) supabase/functions/subscription-lifecycle-sweep/index.ts bestaat en de regel
     const VERSION = "SUB-UNIFY-2A";
     bevat;
  c) supabase/functions/_shared/planLifecycle.ts bestaat en decideCancel, decideResume,
     decidePlanEnding en buildSweepRow exporteert;
  d) supabase/functions/_shared/notificationDefaults.ts de sleutel
     "subscriptions/plan_ended"
     bevat;
  e) supabase/functions/create-notification/index.ts en
     supabase/functions/send-push-notification/index.ts allebei de tekst
     version: "SUB-UNIFY-2A"
     bevatten.
Klopt één ervan niet: meld welke en STOP.

Stap 2 — deploy exact deze vier edge functions, niets anders:
  - sync-tenant-plan
  - subscription-lifecycle-sweep
  - create-notification
  - send-push-notification

Stap 3 — meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt stap X niet, meld dat en STOP — maak geen enkele code- of configwijziging, ook geen build- of testfixes.
Draai geen migraties. Registreer geen cron. Roep de functies niet zelf aan. Commit niets.
Alle vier importeren supabase-js vast op 2.57.2. Faalt de deploy toch op "Module not found"
van esm.sh, meld dat letterlijk en STOP — niets zelf repareren.
```

Geeft send_message na ~230 s een MCP-timeout: NIET opnieuw sturen. Eerst `git ls-remote origin main` (agent-commits? die mogen er niet zijn) en dan de vingerafdruk meten.

## Nameting edge (na stap 1)

1. Zelfde vijf `net.http_get` als de nulmeting. Verwacht a-d = 200 `{"ok":true,"version":"SUB-UNIFY-2A"}`, e = 404. Pas bij vier nieuwe stempels is de deploy bewezen.
2. `git log origin/main -3`: geen onverwachte agent-commits (alles buiten `src/integrations/` = stoppen en uitzoeken). CC pullt daarna.
3. **Eerste dry-run met de hand** (schrijft niets, ook niet met een fout in de body; alleen `{"dry_run": false}` schrijft):
   ```sql
   select net.http_post(
     url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/subscription-lifecycle-sweep',
     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
       (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key')),
     body := '{"dry_run":true}'::jsonb, timeout_milliseconds := 120000);
   -- daarna: select status_code, content from net._http_response where id = <id>;
   ```
   Verwacht (stand 16-10): `dry_run:true`, `downgrade:0`, `excluded:2` (SellQo Speeltuin en SellQo Sandbox, reden `demo`), `applied:0`. Elke andere `downgrade`-rij: STOP en bekijken vóór stap 6.
   Neveneffectvrij nagaan: `select count(*) from notifications where type='plan_ended';` blijft 0.
4. `gh run list --limit 1` na de push tot CI groen staat (nieuwe deno tests `planLifecycle.test.ts` en `lifecycle-sweep.test.ts` zitten in CI).

## Stap 2 — frontend

`deploy_project` (sellqo.app is Lovable-hosted; een push naar main zet de frontend niet live). Verifiëren: `net.http_get` op de index → nieuwe `/assets/index-*.js` → zoek `cancellation` / `Heractiveer` niet (i18n zit in JSON), zoek wel `subscription_cancel_period_end` in de bundel (changelog-id). Voor de iOS/Android-app: pas in de volgende native build (gebundelde code), noteren in de role-audit.

Functioneel op Speeltuin (bc18b2e3-…) kan pas als die een actief facturatie-abonnement heeft; nu niet (sub `cancelled`, demo). Zie beslisvraag 2 in de role-audit.

## Stap 3 — doc_articles

`supabase/migrations/20261016171000_sub_unify_2a_doc_articles.sql` via `query_database`, één aanroep met enkel de inhoud van het bestand. Eerst snapshot:
```sql
create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261016_doc_articles_su2a as
  select * from public.doc_articles where doc_level='tenant' and slug in ('abonnement-en-betaalwijze-beheren','abonnement-beheren');
```
Natrek in een APARTE aanroep: `select slug, md5(content) from public.doc_articles where doc_level='tenant' and slug in ('abonnement-en-betaalwijze-beheren','abonnement-beheren');` → `9639747fd91bc35a5a4468bd704252fc` en `33ba21649b0d121d159b93a76da328a1`. (Op 16-10 al in een rollback-transactie gedraaid: precies die md5's, 1 rij per slug, live daarna onveranderd.)

## Stap 4 — cron in dry-run

`supabase/migrations/20261016170000_sub_unify_2a_lifecycle_sweep_cron.sql` via `query_database`. Body is `{"source":"cron","dry_run":true}`: de cron rapporteert alleen. Natrek: `select jobname, schedule, active, position('"dry_run":true' in command) > 0 from cron.job where jobname='subscription-lifecycle-sweep-daily';` → `50 6 * * *`, `true`, `true`. (Op 16-10 in een rollback getest: jobid aangemaakt, `dry_run_in_body=t`, daarna 0 jobs.)

## Stap 5 — dry-runs nakijken

Na een of meer cron-runs: `cron.job_run_details` volstaat niet (die meldt alleen dat het versturen lukte). Lees het antwoord in `net._http_response`: `select id, created, status_code, content from net._http_response where content like '%SUB-UNIFY-2A%' order by id desc limit 3;`. Elke `downgrade`-rij met naam aan Akke voorleggen.

## Stap 6 — echte modus (APARTE go van Akke)

```sql
select cron.schedule('subscription-lifecycle-sweep-daily', '50 6 * * *', $cmd$ … zelfde command, body '{"source":"cron","dry_run":false}' … $cmd$);
```
Na de eerste echte run: `applied` in het antwoord = aantal verwachte rijen; per tenant natrekken: `tenant_subscriptions.plan_id='free'`, `status='canceled'`, `subscriptions.status='cancelled'`, `tenants.subscription_plan='free'`, één `notifications`-rij `subscriptions/plan_ended`, en **0 nieuwe `billing_cycles`/`invoices`**.

Terugdraaien echte modus: dezelfde `cron.schedule` met `dry_run:true`, of `select cron.unschedule('subscription-lifecycle-sweep-daily');`. Een onterecht teruggezette winkel: plan terugzetten via de platform-admin of `sync-tenant-plan` (activate), nooit met de hand in `subscriptions`.

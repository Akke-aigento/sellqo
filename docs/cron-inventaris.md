# Cron- en edge-function-inventaris

**Datum:** 11 september 2026
**Bron:** `cron.job`, `cron.job_run_details` en `net._http_response` in het live
sellqo-project, plus een classificatie van alle 229 functies in `supabase/functions/`.
**Aanleiding:** §4a van het vervolgplan. Slechts 2 van de 404 migraties bevatten een
`cron.schedule`; de planning van dit project leeft vrijwel volledig in de database en
nergens in versiebeheer. Verdwijnt een job, dan merkt niemand het.

> **De belangrijkste bevinding: vier van de zestien cron-jobs falen bij élke run met een
> 401, en de bestaande monitoring meldt ze allemaal als geslaagd.** Gevolg: de complete
> bol.com-advertentieautomatisering ligt stil sinds **6 mei 2026** — vier maanden. Zie §3
> voor de oorzaken en §4 voor waarom niemand het zag.

---

## 1. De 16 actieve cron-jobs

Alle zestien staan op `active = true`, draaien als `postgres` op database `postgres`.

| jobid | Job | Schema | Doelfunctie | Auth |
|---|---|---|---|---|
| 1 | `marketplace-sync-scheduler` | `*/5 * * * *` | `marketplace-sync-scheduler` | Bearer |
| 2 | `auto-invoice-cron` | `*/5 * * * *` | `auto-invoice-cron` | Bearer |
| 4 | `update-bol-tracking-every-5min` | `*/5 * * * *` | `update-bol-tracking` ⚠️ | Bearer |
| 5 | `sync-bol-inventory-every-30min` | `*/30 * * * *` | `sync-bol-inventory` | Bearer |
| 6 | `poll-tracking-status-every-30min` | `*/30 * * * *` | `poll-tracking-status` ⚠️ | Bearer |
| 7 | `ads-inventory-watch-every-15min` | `*/15 * * * *` | `ads-inventory-watch` ❌ | Bearer |
| 8 | `expire-unpaid-orders-daily` | `0 3 * * *` | `expire-orders` | Bearer |
| 10 | `ads-bolcom-sync-every-30min` | `*/30 * * * *` | `ads-bolcom-scheduler` | Bearer |
| 11 | `ads-bolcom-reports-4x-daily` | `0 0,6,12,18 * * *` | `ads-bolcom-scheduler` | Bearer |
| 12 | `ads-ai-engine-daily` | `0 2 * * *` | `ads-bolcom-scheduler?mode=ai` | Bearer |
| 13 | `expire-invitations` | `0 3 * * *` | *(pure SQL)* | n.v.t. |
| 47 | `generate-subscription-invoices-daily` | `0 6 * * *` | `generate-subscription-invoices` | apikey |
| 61 | `process-invoice-dunning-daily` | `0 7 * * *` | `process-invoice-dunning` | apikey |
| 70 | `sync-odoo-invoices-hourly` | `17 * * * *` | `sync-odoo-invoices` | apikey |
| 114 | `process-cycle-reminders-daily` | `30 7 * * *` | `process-cycle-reminders` | apikey |
| 118 | `check-expired-trials-daily` | `45 6 * * *` | `check-expired-trials` | apikey |

⚠️ = doelfunctie bestaat niet in de repo (§2) · ❌ = faalt aantoonbaar (§3)

**Twee generaties.** Jobs 1–12 sturen `Authorization: Bearer <anon key>`; jobs 47 en hoger
sturen `apikey`. Alle Bearer-tokens zijn identiek (zelfde md5, 208 tekens), dus een
verlopen sleutel in één job is uitgesloten als oorzaak.

**Eén schijnbare afwijking, opgelost.** `ads-ai-engine-daily` roept
`ads-bolcom-scheduler?mode=ai` aan, niet `ads-ai-engine`. Dat is een modusparameter, geen
verkeerde koppeling.

**De jobid-reeks loopt tot 118 en er zijn er 16 over.** Er zijn dus in de loop van de tijd
ruim honderd cron-jobs aangemaakt en weer verdwenen, zonder dat daar in de repo iets van
terug te vinden is.

---

## 2. Negen functies staan niet in de repo maar draaien wél

`update-bol-tracking` (elke 5 minuten) en `poll-tracking-status` (elke 30 minuten) hebben
geen map onder `supabase/functions/`. Beide zijn verwijderd in commit **`b9fa64bd`
("Reverted to commit 2573bd41…", 28 maart 2026)** — een revert die tien edge functions
weghaalde, waarvan alleen `_shared` is teruggekomen.

**Ze zijn nog gedeployed.** Bewezen met een `net.http_get`-probe vanuit de database, met een
verzonnen functienaam als controle:

| Probe | Status | Antwoord | Conclusie |
|---|---|---|---|
| `zzz-bestaat-niet` *(controle)* | 404 | `{"code":"NOT_FOUND","message":"Requested function was not found"}` | zo ziet een échte 404 eruit |
| `update-bol-tracking` | 500 | `{"error":"Unexpected end of JSON input"}` | draait; struikelt over de lege GET-body |
| `poll-tracking-status` | 200 | `{"success":true,"updated":0}` | draait en werkt |
| `handle-bol-return` | 500 | `{"success":false,"error":"Unexpected end of JSON input"}` | draait |
| `sync-bol-products` | 500 | `{"success":false,"error":"Unexpected end of JSON input"}` | draait |
| `generate-legal-pages` | 401 | `{"error":"Unauthorized"}` | draait, achter auth |

**Repo-verwijdering is geen undeploy.** Net zoals Lovable een functie wel schrijft maar niet
uitrolt (R6 in `sellqo-engineering-rules`), haalt het verwijderen van een map hem niet uit
Supabase. Er draaide dus sinds 28 maart productiecode waarvan de bron niet in versiebeheer
zat — minstens vijf van de negen, en de overige vier zijn niet geprobed.

> **Opgelost op 11 sep 2026 (ORPHAN-FN-1).** Alle negen staan weer in de repo, byte-voor-byte
> hersteld uit `b9fa64bd^` en met sha256 geverifieerd. **Er is niets gedeployed en niets
> uitgezet** — restore is geen redeploy, en of de gedeployede versie nog gelijk is aan die
> van maart is niet vast te stellen. De bestanden zijn ook bewust niet opgeschoond: hun
> waarde is dat ze gelijk zijn aan wat er draait. Wat nog openstaat is per functie besluiten:
> houden of undeployen.

`poll-tracking-status` blijkt bovendien de bron van het `{"success":true,"updated":0}` dat
in de responslog terugkwam: die halfuurjob is dus gezond.

> **Methode, voor hergebruik.** Of een edge function gedeployed is, is niet uit de database
> af te lezen — maar wél te meten. Een `net.http_get` naar `…/functions/v1/<naam>` geeft bij
> een onbekende functie een gateway-404 (`NOT_FOUND`) vóór er code draait. Neem altijd een
> verzonnen naam als controle mee, anders weet je niet hoe een echte 404 eruitziet. Gebruik
> GET en geen POST: zonder body struikelen de meeste functies op het parsen en voeren ze
> geen werk uit.

## 3. Vier jobs falen — met twee verschillende oorzaken

`net._http_response` bewaart de antwoorden van `net.http_post`. Over zes uur:

| Antwoord | Aantal | Patroon | Job(s) |
|---|---|---|---|
| `{"success":true,…}` diverse | 131 | — | de gezonde twaalf |
| `{"success":false,"error":"Invalid or expired token"}` | 24 | `:00 :15 :30 :45` | `ads-inventory-watch` (7) |
| `{"error":"Unauthorized"}` | 13 | `:00 :30` | `ads-bolcom-scheduler` (10, 11, 12) |
| *(null)* | 119 | — | time-out of nog niet afgerond |

Beide toegewezen met dezelfde GET-probe als in §2.

### 3a. `ads-inventory-watch` — een cron met een gebruikerssessie

De functie importeert `_shared/auth.ts` (regel 2) en roept `authenticateRequest` aan. Die
valideert een **gebruikers-JWT**: `_shared/auth.ts:77` gooit `"Invalid or expired token"`.
De cron stuurt de **anon-sleutel** als bearer — en dat is geen gebruikerstoken.

**Een cron-job heeft per definitie geen ingelogde gebruiker.** Dit kan dus nooit gewerkt
hebben; het is geen regressie maar een ontwerpfout. Bevestigd door de probe: zonder header
antwoordt hij `"Missing or invalid Authorization header"`, mét de anon-sleutel
`"Invalid or expired token"` — twee takken van dezelfde helper.

> **Terzijde, en het is een R2-overtreding.** Regel 1 van deze functie importeert
> `https://esm.sh/@supabase/supabase-js@2` — **ongepind**. Precies de constructie die volgens
> `sellqo-engineering-rules` R2 ooit de hele auth-laag platlegde toen een redeploy die
> specifier liet doorlopen naar een nieuwere v2.x.

### 3b. `ads-bolcom-scheduler` — een letterlijke sleutelvergelijking

```js
const expectedAnon = `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`;
const expectedService = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
if (authHeader !== expectedAnon && authHeader !== expectedService) → 401
```

Geen JWT-validatie maar een **string-vergelijking**. De sleutel in de cron-commando's is
identiek aan die in `.env` (zelfde md5, 208 tekens), dus het verschil moet zitten in wat
Supabase als `SUPABASE_ANON_KEY` in de functie-omgeving injecteert — vermoedelijk het nieuwe
`sb_publishable_…`-formaat in plaats van de oude JWT. Beide sleutels zijn geldig voor het
project; alleen de letterlijke vergelijking mislukt.

Dit raakt **drie** jobs tegelijk, want alle drie wijzen op dezelfde functie: `ads-bolcom-sync`
(elke 30 min), `ads-bolcom-reports` (4× per dag) en `ads-ai-engine` (dagelijks 02:00).

### 3c. Wat het gekost heeft

De bol.com-advertentiemodule levert geen data:

| Tabel | Rijen |
|---|---|
| `ads_bolcom_campaigns` | 4, **laatst bijgewerkt 6 mei 2026** |
| `ads_bolcom_performance` | 0 |
| `ads_bolcom_keywords` | 0 |
| `ads_bolcom_search_terms` | 0 |
| `ads_ai_recommendations` | 0 |

Eén campagne staat op `active`. Er is sinds 6 mei geen enkel prestatiecijfer binnengekomen —
vier maanden. De AI-regels (`ads_ai_rules`, 2 rijen) hebben nooit iets gehad om op te werken.

## 4. Waarom niemand dit zag — en dat is de echte les

`cron.job_run_details` meldt **alle** zestien jobs als `succeeded`, ook de twee die falen.
Dat is geen bug in de monitoring maar een eigenschap van de opzet:

```sql
SELECT net.http_post(url := '…/functions/v1/…', headers := '…', body := '…');
```

`net.http_post` is **asynchroon**. Het zet het verzoek in een wachtrij en geeft direct een
rij terug. De cron-job registreert dus het succes van het *inplannen*, nooit het antwoord.
Een 401, een 404 of een time-out levert exact dezelfde groene regel op als een 200.

> **Een cron-job die een edge function aanroept, kan per constructie niet falen in
> `cron.job_run_details`.** Wie daarop vertrouwt, bewaakt niets.

Het antwoord staat wél in `net._http_response`, maar die tabel wordt door pg_net na korte
tijd opgeruimd (nu 287 rijen, circa zes uur historie) en niemand kijkt erin.

**Bijkomend praktisch punt:** `cron.job_run_details` is te groot om te bevragen. Elke
`order by`, `group by` of `count(*)` erover loopt in een time-out; alleen een filter op
`jobid` met een `limit` komt terug. Wie hier ooit iets uit wil halen, moet gericht
filteren.

---

## 5. Alle 229 edge functions, ingedeeld

| Categorie | Aantal | Betekenis |
|---|---|---|
| Aangeroepen vanuit `src/` | 157 | in gebruik |
| Aangeroepen door een cron-job | 11 | in gebruik |
| Aangeroepen door een andere edge function | 18 | in gebruik |
| Extern aangeroepen (webhook, oauth-callback) | 11 | verwacht geen aanroeper in de repo |
| Aangeroepen door de custom frontends | 2 | `storefront-api`, `storefront-customer-api` |
| Eenmalig script (`backfill-*`, `repair-*`, `regression-*`) | 5 | hoort geen aanroeper te hebben |
| Alleen genoemd in een migratie | 2 | te controleren |
| **Geen aanroeper gevonden** | **23** | zie hieronder |

### De 23 zonder aanroeper

`ai-chatbot-respond`, `ai-generate-ab-variant`, `automation-scheduler`,
`check-scheduled-notifications`, `create-amazon-buy-shipping-label`,
`create-bank-transfer-order`, `create-checkout-session`, `create-return-label`,
`create-shipping-label`, `handle-inbound-email`, `nano-studio`, `newsletter-confirm`,
`odoo-correct-move-tax`, `odoo-list-taxes`, `odoo-read-move`, `process-gift-card-purchase`,
`reset-monthly-ai-credits`, `scanner-context`, `send-trial-expiry-warning`,
`sync-bol-campaign-status`, `sync-cron-vault-key`, `test-shopify-connection`,
`warmup-vat-cache`.

**De scherpste groep daarbinnen: vijf namen die klinken als een cron, zónder cron-job.**
`automation-scheduler`, `check-scheduled-notifications`, `reset-monthly-ai-credits`,
`send-trial-expiry-warning`, `warmup-vat-cache`. Gezien §2 — waar twee jobs een verwijderde
functie aanroepen — is het omgekeerde even aannemelijk: een functie die zijn job heeft
verloren. In dat geval draait er iets niet meer zonder dat het zich meldt. Dit is de eerste
groep om na te lopen.

**Waarschijnlijk onterecht in deze lijst:** `handle-inbound-email` (vrijwel zeker een
externe mailhook) en de drie `odoo-*`-functies (mogelijk aangeroepen vanuit
`sync-odoo-invoices`, dat wél een cron heeft). Die staan hier omdat de detectie op letterlijke
naamreferenties werkt, niet omdat ze bewezen dood zijn.

---

## 6. Wat hieruit volgt

1. **`ads-bolcom-scheduler` repareren** — grootste opbrengst, kleinste ingreep. De
   letterlijke sleutelvergelijking vervangen. Het juiste patroon staat al in deze codebase:
   `sync-cron-vault-key` vergelijkt een `x-cron-secret`-header met een waarde uit
   `internal_config`. Dat werkt ongeacht welk sleutelformaat Supabase injecteert. Herstelt
   drie jobs in één keer.
2. **`ads-inventory-watch` herontwerpen.** `authenticateRequest` verwacht een gebruiker; een
   cron heeft die niet. Zelfde cron-secret-patroon, of service-role. Meteen de ongepinde
   `@2`-import rechttrekken (R2).
3. **De negen niet-gecommitte functies terughalen of undeployen.** Er draait productiecode
   zonder bron. Per functie kiezen: bron terug in de repo (uit `b9fa64bd^`) of uitzetten. Voor
   `poll-tracking-status` en `update-bol-tracking` geldt bovendien dat hun cron-jobs actief
   zijn, dus uitzetten betekent ook de job stoppen.
4. **De vijf cron-loze schedulers nalopen** — dood, of een verdwenen schema (§5).
5. **De planning in versiebeheer brengen.** Een migratie die de zestien schema's idempotent
   (her)plant, zodat de repo de waarheid wordt.
6. **Monitoring die wél kan falen.** Zolang `net.http_post` asynchroon is, moet de controle
   uit `net._http_response` komen — of elke cron-functie schrijft zijn laatste geslaagde run
   weg, zodat "wanneer draaide dit voor het laatst" een gewone query wordt. Een dagelijkse
   check op die tabel had dit vier maanden eerder gezien.

## 7. Beperkingen van dit document

- **Geen runhistorie.** `cron.job_run_details` is niet te aggregeren binnen de
  connector-time-out; elke `count`, `group by` of `order by` wordt afgebroken. De
  uitspraken over falen komen uit `net._http_response`, dat slechts enkele uren bewaart.
- **De deploystatus van functies is niet uit de database te lezen.** Of een functie in
  Supabase staat, en sinds wanneer, staat in het dashboard.
- **De indeling in §5 is op letterlijke naamreferenties gebaseerd.** Die methode is deze
  week drie keer bijgesteld — multiline `invoke()`, `cron.job`, en rauwe
  `fetch(.../functions/v1/…)` werden achtereenvolgens gemist. Behandel "geen aanroeper" als
  een kandidaat, niet als een vonnis.

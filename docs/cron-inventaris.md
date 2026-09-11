# Cron- en edge-function-inventaris

**Datum:** 11 september 2026
**Bron:** `cron.job`, `cron.job_run_details` en `net._http_response` in het live
sellqo-project, plus een classificatie van alle 229 functies in `supabase/functions/`.
**Aanleiding:** §4a van het vervolgplan. Slechts 2 van de 404 migraties bevatten een
`cron.schedule`; de planning van dit project leeft vrijwel volledig in de database en
nergens in versiebeheer. Verdwijnt een job, dan merkt niemand het.

> **De belangrijkste bevinding staat in §3: twee cron-doelen falen op dit moment bij élke
> run met een 401, en de bestaande monitoring meldt ze allebei als geslaagd.** Dat is geen
> toeval maar een constructiefout — zie §4.

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

## 2. Twee jobs wijzen naar een functie die niet in de repo staat

`update-bol-tracking` (elke 5 minuten) en `poll-tracking-status` (elke 30 minuten) hebben
geen map onder `supabase/functions/`. Beide zijn verwijderd in commit **`b9fa64bd`
("Reverted to commit 2573bd41…", 28 maart 2026)** — een revert die tien edge functions
weghaalde. De cron-jobs zijn nooit meegestopt.

Van die tien is alleen `_shared` teruggekomen. Negen ontbreken nog steeds:

`generate-legal-pages`, `handle-bol-return`, `poll-tracking-status`,
`process-gift-card-order`, `process-order-refund`, `storefront-contact-form`,
`sync-bol-products`, `sync-bol-returns`, `update-bol-tracking`.

**Repo-verwijdering is geen undeploy.** Net zoals Lovable een functie wel schrijft maar niet
uitrolt (R6 in `sellqo-engineering-rules`), haalt het verwijderen van een map de functie
niet uit Supabase. Er zijn dus twee mogelijkheden, en ze zijn allebei ongewenst:

- De functies dráaien nog — dan staat er sinds maart productiecode live waarvan de bron niet
  in versiebeheer zit.
- Ze draaien niet — dan vuurt er sinds maart elke 5 respectievelijk 30 minuten een job in
  het niets.

Welke van de twee het is, is uit de database niet af te lezen. Het staat in de Edge
Functions-lijst van het Supabase-dashboard: staat de functie daar met een `deployed_at`, dan
is het de eerste.

---

## 3. Twee doelen falen nu, bij elke run

`net._http_response` bewaart de antwoorden van `net.http_post`. Over de laatste zes uur:

| Antwoord | Aantal | Patroon | Oordeel |
|---|---|---|---|
| `{"success":true,…}` diverse | 131 | — | in orde |
| `{"success":false,"error":"Invalid or expired token"}` | 24 | `:00 :15 :30 :45` | **faalt** |
| `{"error":"Unauthorized"}` | 13 | `:00 :30` | **faalt** |
| *(null)* | 119 | — | time-out of nog niet afgerond |

**Het kwartierpatroon is eenduidig.** Er is precies één job met `*/15 * * * *`:
`ads-inventory-watch` (jobid 7). Die functie **draait** — het antwoord is
applicatieniveau, geen gateway-fout — en verwerpt vervolgens zijn eigen token. Elke vijftien
minuten, de klok rond.

**De halfuurfout is nog niet op één job vast te pinnen.** `{"error":"Unauthorized"}` is de
gateway-vorm, dus daar kwam geen functiecode aan te pas. Er zijn drie kandidaten met
`*/30 * * * *`: `sync-bol-inventory` (5), `poll-tracking-status` (6) en
`ads-bolcom-scheduler` (10). Ze gebruiken hetzelfde token, dus het verschil zit in de
functie. Te bepalen met de per-functie-logs in het Supabase-dashboard; dat is één blik.

---

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

Op volgorde van urgentie:

1. **De twee 401's oplossen.** `ads-inventory-watch` faalt elk kwartier; dat is bewezen. De
   halfuurfout eerst toewijzen aan een job via de dashboard-logs.
2. **Uitzoeken of de negen verwijderde functies nog gedeployed zijn.** Zo ja: bron terug in
   de repo of undeployen. Zo nee: de twee cron-jobs stoppen.
3. **De vijf cron-loze schedulers nalopen** — dood, of een verdwenen schema.
4. **De planning in versiebeheer brengen.** Een migratie die de zestien schema's
   idempotent (her)plant, zodat de repo de waarheid wordt in plaats van de database.
5. **Monitoring die wél kan falen.** Zolang `net.http_post` asynchroon is, moet de
   controle uit `net._http_response` komen — of de functies moeten zelf hun laatste
   succesvolle run wegschrijven, zodat "wanneer draaide dit voor het laatst" een gewone
   query wordt.

---

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

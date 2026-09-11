# Plan — herbouw bol.com-advertentie-integratie

**Datum:** 11 september 2026 · **Status:** uitgevoerd, wacht op deploy
**Resultaat:** `docs/role-audit.md` (ADS-REBUILD-1) · **Contract:** zie hieronder

> **Tijdens de uitvoering kwamen er twee dingen bij die dit plan niet voorzag.** Ze zijn
> allebei doorgevoerd; het plan hieronder is de stand van vóór die vondsten.
>
> 1. **De reporting-respons heeft geen datumdimensie** — `total` + `subTotals` per
>    entiteit, geaggregeerd over de periode. Dagcijfers vergen dus één aanroep per dag.
>    `ads-bolcom-reports` haalt nu standaard zeven dagen opnieuw op, omdat alle
>    conversiemetrieken `14d` zijn en een dag pas na twee weken vaststaat.
> 2. **`targetProducts` heeft geen EAN** — dat is het product waaróp je adverteert. Het
>    geadverteerde artikel is een `ad`. `ads_bolcom_targeting_products` wordt daarom
>    gevuld uit `/ads/list`. Dat is ook wat `ads-inventory-watch` nodig heeft, en die
>    functie heeft nooit gewerkt omdat deze tabel leeg was.
>
> Ook opgelost: de `Accept`-header voor reporting is nu `application/json`, want de spec
> declareert daar niets anders. Die vraag stond in §3 nog open.
**Contract:** [`docs/bol-advertising-api-v11.md`](bol-advertising-api-v11.md)

---

## 1. Drie fouten, niet één

Bij het uitschrijven van dit plan bleken er naast de verkeerde API-paden nog twee
onafhankelijke fouten te zitten. Alle drie moeten weg; elke fout apart is al genoeg om
de integratie leeg te houden.

### Fout 1 — verkeerde API-paden (bekend)

Zes van de zeven aanroepen bestaan niet. Zie het contractdocument.

### Fout 2 — `onConflict` verwijst naar indexen die niet bestaan

Nagetrokken op de live database (`pg_indexes`, 11 sep 2026):

| Tabel | `onConflict` in de code | Bestaat er zo'n unieke index? |
|---|---|---|
| `ads_bolcom_campaigns` | `tenant_id,bolcom_campaign_id` | ✅ ja |
| `ads_bolcom_adgroups` | `tenant_id,bolcom_adgroup_id` | ✅ ja |
| `ads_bolcom_keywords` | `tenant_id,adgroup_id,keyword,match_type` | ❌ **nee** |
| `ads_bolcom_targeting_products` | `tenant_id,adgroup_id,ean` | ❌ **nee** |
| `ads_bolcom_performance` | `tenant_id,campaign_id,date` | ❌ **nee** — de index is vijfkolommig |
| `ads_bolcom_search_terms` | `tenant_id,search_term,date` | ❌ **nee** |

PostgreSQL weigert een `ON CONFLICT` die geen unieke index aanwijst met `42P10`. **Vier
van de zes wegschrijfacties zouden dus alsnog falen, ook als elk API-pad morgen klopt.**

En ze zouden stil falen. Het patroon in beide functies is
`if (!error) teller++; else console.error(...)`: de fout gaat naar de log, de teller
blijft nul, en de functie meldt zichzelf als geslaagd. Precies het patroon uit R8.

### Fout 3 — de enige juiste index dedupliceert niet

`ads_bolcom_performance` heeft
`UNIQUE (tenant_id, campaign_id, adgroup_id, keyword_id, date)`, en `adgroup_id` en
`keyword_id` zijn nullable. Bij campagne-niveau-rijen zijn ze `NULL`.

In PostgreSQL is `NULL` nooit gelijk aan `NULL`, en de index staat op de standaard
`NULLS DISTINCT`. Twee campagnerijen voor dezelfde campagne op dezelfde dag zijn voor
deze index dus géén duplicaat. Het gevolg: **elke dagelijkse run zou dezelfde dag
opnieuw toevoegen** en de grafieken zouden gaan optellen.

De database draait PostgreSQL 17.6, dus `NULLS NOT DISTINCT` is beschikbaar. Dat is de
schone oplossing.

### Waarom dit nooit is opgevallen

Fout 1 zit vóór fout 2 en 3 in de keten. De fetch faalde altijd, dus er kwam nooit een
rij bij de upsert. Huidige stand: 4 campagnes, en `adgroups`, `keywords`,
`performance`, `search_terms`, `targeting_products` alle vijf op **0**.

> Dit is precies waarom stap 1 hieronder een migratie is en geen code. Zou ik alleen de
> paden repareren, dan verschuift het probleem van "fetch faalt" naar "upsert faalt" —
> even onzichtbaar, en met een run die zichzelf groen meldt.

---

## 2. De volgorde

Twee harde afhankelijkheden bepalen de vololgorde:

1. **Schrijven moet werken vóór er data komt** — anders debug ik straks een lege tabel
   met een correcte fetch.
2. **`/performance/search-term` verlangt `ad-group-ids`** — en wij hebben nul ad groups,
   omdat juist die sync-aanroep kapot is. Zoektermen kunnen dus pas als laatste.

### Stap 1 — migratie: de ontbrekende unieke indexen

Nieuw bestand `supabase/migrations/<ts>_ads_bolcom_unique_indexes.sql`.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_keywords_uniq
  ON public.ads_bolcom_keywords (tenant_id, adgroup_id, keyword, match_type);

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_targeting_products_uniq
  ON public.ads_bolcom_targeting_products (tenant_id, adgroup_id, ean);

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_search_terms_uniq
  ON public.ads_bolcom_search_terms (tenant_id, campaign_id, adgroup_id, search_term, date)
  NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_performance_uniq
  ON public.ads_bolcom_performance (tenant_id, campaign_id, adgroup_id, keyword_id, date)
  NULLS NOT DISTINCT;
```

**Strikt additief.** Alleen `CREATE INDEX`; geen kolom raakt aan, geen bestaande index
wordt gedropt. Idempotent via `IF NOT EXISTS`. De vijf tabellen zijn leeg op
`ads_bolcom_campaigns` na, dus geen enkele index kan op bestaande duplicaten stuklopen —
nagetrokken, niet aangenomen. `DOWN` in commentaar: `DROP INDEX <naam>`.

De oude vijfkolommige index blijft staan; hij hindert niet en droppen is onomkeerbaar
(DB-safety). Alleen de nieuwe wordt in `onConflict` aangewezen.

### Stap 2 — gedeelde helper `_shared/bolAdvertising.ts`

Beide functies hebben nu een eigen kopie van `getBolToken`, `bolGet`, `bolPost`,
`ADV_HEADERS` en `withRetry` — regels 18-61 van de één zijn regels 18-46 van de ander.
Die duplicatie is hoe de twee uit elkaar konden lopen. Eén bestand, met:

- `getBolToken`, `withRetry` (token-vernieuwing bij 401)
- `advPost(token, path, body)` voor campaign-management
- `reportGet(token, path, params)` voor reporting — **bouwt de querystring en stuurt
  géén `Content-Type`**, want een GET heeft geen body en sommige gateways weigeren dat
- `chunk(ids, 100)` voor de `entity-ids`-limiet
- De import gepind op `@supabase/supabase-js@2.57.2` (R2 — beide functies staan nu op
  het ongepinde `@2`, de specifier die de auth-laag al eens plat legde)

**R6-let op:** een gewijzigd `_shared/`-bestand is geen eigen functie. Alleen deze twee
importeren het, maar beide moeten mee in de deploy.

### Stap 3 — `ads-bolcom-sync`

| Nu | Wordt |
|---|---|
| `GET campaigns/{id}/ad-groups` | `POST ad-groups/list` met `{ filter: { campaignIds: [id] }, page, pageSize: 100 }` |
| `GET ad-groups/{id}/keywords` | `POST keywords/list` |
| `GET ad-groups/{id}/target-products` | `POST target-products/list` |

Plus: paginering (`pageSize` max 100, dus doorlussen tot een lege pagina), en de
`onConflict`-doelen omgezet naar de indexen uit stap 1.

De dode `X-Sync-Secret`/`CRON_SECRET`-tak (regels 74-76) blijft voorlopig staan — de
scheduler roept aan met de service-role key en dát pad werkt. Opruimen hoort bij het
cron-werk (§3b van het lopende plan), niet hier; twee dingen tegelijk veranderen maakt
een mislukte run ondiagnostiseerbaar.

### Stap 4 — `ads-bolcom-reports`, campagneniveau

Basis van `…/insights` naar `…/reporting`. `POST` wordt `GET` met query-parameters:

```
GET /performance?entity-type=CAMPAIGN&entity-ids=…&period-start-date=…&period-end-date=…
```

- `bolCampaignIds.map(Number)` **eruit** — ID's zijn strings
- `entity-ids` in blokken van 100
- Periode van 30 naar **29 dagen** — 30 is de bovengrens en dat is over een tijdzonegrens
  net te krap
- `onConflict` naar `ads_bolcom_performance_uniq`

Dit is het eerste punt waarop er echte cijfers in de database horen te staan.

### Stap 5 — keyword-performance en zoektermen

Pas als stap 3 ad groups en keywords heeft opgeleverd.

- Keyword-performance: hetzelfde `GET /performance`, met `entity-type=KEYWORD`
- Zoektermen: `GET /performance/search-term` met `ad-group-ids`

---

## 3. Wat ik niet ga doen

**Niet proben tegen productie.** Jouw waarschuwing dat de bol.com-API gevoelig ligt
staat. Elke stap wordt tegen de specificatie geschreven, uitgerold, en dan wacht ik de
reguliere cron af in plaats van handmatig te vuren. Trager, maar ik schiet niets af.

**Geen aanname over de `Accept`-header.** De code stuurt
`application/vnd.advertiser.v11+json`. Dat werkt aantoonbaar op campaign-management
(`campaigns/list` slaagt). Voor de reporting-API is het niet geverifieerd — de browser
laat me niet meer navigeren. Ik houd dezelfde header aan, want het is dezelfde
API-familie en dezelfde versie, en ik noteer het als de eerste verdachte als stap 4 een
400 geeft. Ik ga er niet omheen raden met live aanroepen.

**Geen kolommen of indexen droppen.** Alleen toevoegen.

**Niet alles in één commit.** Vijf stappen, vijf commits. Stap 4 kan pas beoordeeld
worden als stap 1 en 3 hun werk hebben gedaan.

---

## 4. Verificatie per stap

| Stap | Bewijs |
|---|---|
| 1 | Migratie twee keer draaien geeft hetzelfde `pg_indexes`-resultaat; de vier indexen bestaan |
| 2 | `tsc` exit 0, lint tegen baseline, geen ongepinde `@2` meer in beide functies |
| 3 | Na een cron-run: `ads_bolcom_adgroups` > 0, en `adgroups_synced` in het antwoord komt overeen met de rijtelling |
| 4 | `ads_bolcom_performance` > 0; tweede run voegt **geen** rijen toe maar werkt ze bij (dat toetst fout 3) |
| 5 | `ads_bolcom_keywords` en `_search_terms` > 0 |
| Elke stap | `failures: []` in de respons, HTTP 200 in plaats van 207 |

De telling-na-tweede-run in stap 4 is de belangrijkste: dat is de enige test die
bewijst dat de deduplicatie werkt, en die had bij de oorspronkelijke bouw ontbroken.

**Slottaken** (`CLAUDE.md` §4): role-audit per stap. Changelog, `doc_articles` en
nieuwsbriefwachtrij bij stap 4 — dán verandert er tenant-zichtbaar gedrag, want de
advertentiedashboards vullen zich voor het eerst met echte cijfers.

---

## 5. Wat jij moet doen

**Per stap die `supabase/functions/**` raakt: uitrollen via Lovable.** De Supabase-CLI
kan dit project niet deployen (403). Bij stap 1 hoort ook de migratie te draaien.

Daarna niets — de verificatie draai ik zelf met `query_database`.

---

## 6. Wat er open blijft

- **Een test-omgeving** voor de advertiser-API is niet gevonden in de documentatie.
- **Rate limits en dagquota** staan niet in deze twee specs. De 429-afhandeling met
  `Retry-After` blijft daarom staan.
- **De Bulk Reporting API** is niet bekeken; bij groei mogelijk efficiënter.

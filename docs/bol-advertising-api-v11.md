# Bol.com Advertising API v11 — de juiste contracten

**Datum:** 11 september 2026
**Bron:** de officiële OpenAPI-specificaties:

- `https://api.bol.com/advertiser/docs/specs/sponsored-products/v11/campaign-management.yml`
- `https://api.bol.com/advertiser/docs/specs/sponsored-products/v11/reporting.yml`

> **Er is geen enkele aanroep naar de bol.com-API gedaan om dit te achterhalen.** Alles
> komt uit de gepubliceerde specificaties — statische documentatie, zonder credentials,
> die de advertentieaccounts niet raakt. Dat is bewust: de API ligt gevoelig, dus de
> herbouw gebeurt tegen het contract en niet door te proberen.

**Aanleiding:** van de zeven bol.com-aanroepen in `ads-bolcom-sync` en
`ads-bolcom-reports` werkte er precies één. Bij het natrekken bleken er nog drie
onafhankelijke fouten onder te liggen. Zie `docs/role-audit.md` (ADS-REBUILD-1).

---

## 1. De endpoints

### Campaign Management

**Basis:** `https://api.bol.com/advertiser/sponsored-products/campaign-management`
**Mediatype:** `application/vnd.advertiser.v11+json`

Alle lees-endpoints zijn `POST …/list` met dezelfde vorm:

```json
{ "filter": { "campaignIds": ["1000000001348050"], "states": ["ENABLED", "PAUSED"] },
  "page": 1, "pageSize": 100 }
```

`pageSize` is maximaal 100 (standaard 50); elk `…Ids`-filter accepteert maximaal 100
waarden.

| Endpoint | Antwoordsleutel | Filtervelden |
|---|---|---|
| `POST /campaigns/list` | `campaigns` | `campaignIds`, `states` |
| `POST /ad-groups/list` | `adGroups` | `adGroupIds`, `campaignIds`, `states` |
| `POST /keywords/list` | `keywords` | `keywordIds`, `adGroupIds`, `campaignIds`, `states` |
| `POST /ads/list` | `ads` | `adIds`, `adGroupIds`, `campaignIds` |
| `POST /target-products/list` | `targetProducts` | `targetProductIds`, `adGroupIds`, `campaignIds`, `states` |

Omdat elk filter `campaignIds` accepteert, is er geen geneste lus nodig: ad groups,
keywords en ads worden per blok campagnes in één keer opgehaald.

### Reporting

**Basis:** `https://api.bol.com/advertiser/sponsored-products/reporting`
**Mediatype:** `application/vnd.advertiser.v11+json` — hetzelfde als campaign-management.

> **Let op, dit kostte een ronde.** `reporting.yml` declareert in élk `content:`-blok
> uitsluitend `application/json`, en daar is op 11 september ten onrechte uit
> geconcludeerd dat dát de Accept-header moest zijn. Elke aanroep kreeg:
>
> ```
> 406 — Accept headers are required (e.g. 'application/vnd.retailer.{version}+json').
>       No wildcards allowed i.e. '*/*', 'application/*', '*/json'.
> ```
>
> Een OpenAPI-`content:`-blok beschrijft het formaat van de **response body**, niet de
> Accept-header die de gateway eist. Bol.com wil altijd een vendor-mediatype. Het
> voorbeeld in de foutmelding noemt `vnd.retailer`; dat is de generieke gatewaytekst,
> niet het type voor deze API.

**Methode is GET met query-parameters**, geen POST met body.

| Endpoint | Verplichte parameters |
|---|---|
| `GET /performance` | `entity-type`, `entity-ids` (1-100), `period-start-date`, `period-end-date` |
| `GET /performance/search-term` | `ad-group-ids` (1-100), `period-start-date`, `period-end-date`, optioneel `page`, `page-size` (max 100) |
| `GET /performance/target-page` | op ad-group-niveau, uitgesplitst naar `SEARCH` / `CATEGORY` / `PDP` |
| `GET /performance/advertiser` | accountniveau |

`entity-type`: `CAMPAIGN`, `AD_GROUP`, `AD`, `KEYWORD`, `TARGET_CATEGORY`,
`TARGET_PRODUCT`. Eén endpoint dekt dus campagne-, ad-group- én keyword-performance.

Datums zijn `YYYY-MM-DD` en mogen hoogstens 30 dagen terug.

---

## 2. Vier fouten in de oude implementatie

### Fout 1 — zes van de zeven paden bestaan niet

| Oude aanroep | Juist |
|---|---|
| `POST campaign-management/campaigns/list` | ✅ klopte |
| `GET campaign-management/campaigns/{id}/ad-groups` | `POST /ad-groups/list` |
| `GET campaign-management/ad-groups/{id}/keywords` | `POST /keywords/list` |
| `GET campaign-management/ad-groups/{id}/target-products` | `POST /ads/list` (zie fout 2) |
| `POST insights/campaigns` | `GET reporting/performance` |
| `POST insights/keywords` | `GET reporting/performance` met `entity-type=KEYWORD` |
| `POST insights/search-terms` | `GET reporting/performance/search-term` |

`campaigns/list` werkte omdat het per toeval de juiste vorm had. De `insights`-API
bestaat wel, maar doet iets anders: gemiddelde winnende biedingen voor zoektermen die
je zelf aanlevert.

### Fout 2 — `targetProducts` heeft geen EAN

`targetProductResponse` bevat alleen `targetProductId`, `adGroupId`, `campaignId` en
`state`. Een target product is het product waaróp je adverteert (PDP-targeting).

Het artikel dát geadverteerd wordt is een **ad**, en `adResponse` heeft wél een `ean`.

Onze tabel `ads_bolcom_targeting_products` koppelt via `product_id` naar onze eigen
producten, en `ads-inventory-watch` gebruikt die koppeling om campagnes te pauzeren
zodra onze voorraad opraakt. Dat is per definitie het geadverteerde artikel. De bron is
dus `/ads/list`, niet `/target-products/list`.

### Fout 3 — veldnamen die niet bestaan

| Object | Velden in v11 | Wat de oude code las |
|---|---|---|
| `adGroup` | `adGroupId`, `campaignId`, `name`, `state`, `targetPages` | ook `defaultBid` — **bestaat niet**; een ad group heeft geen eigen bod |
| `keyword` | `keywordId`, `adGroupId`, `campaignId`, `keywordText`, `matchType`, `state`, `bid{amount,currency}` | `kw.text \|\| kw.keyword` — **geen van beide bestaat** |
| `ad` | `adId`, `adGroupId`, `campaignId`, `ean`, `state` | — |

De keyword-fout is de gemeenste: ook met een werkend pad was élke keyword als lege
string opgeslagen.

### Fout 4 — de reporting-respons heeft geen datum

```
{ "entityCount": …, "total": { …metrics… }, "subTotals": [ { entityType, entityId,
  campaignId, adGroupId, …metrics… } ] }
```

**Er is geen `date`-veld.** De API aggregeert over de opgevraagde periode en splitst
per entiteit, niet per dag. De oude code vroeg één periode van 30 dagen op en las
`row.date`; elke rij zou op `continue` zijn gestrand.

Onze tabel is wél per dag opgezet. De enige manier om dagcijfers te krijgen is dus
**één aanroep per dag**, met start- en einddatum gelijk.

---

## 3. De metrieken

`PerformanceMetrics`, identiek voor alle reporting-endpoints:

| Veld | Onze kolom |
|---|---|
| `impressions` | `impressions` |
| `clicks` | `clicks` |
| `cost` | `spend` |
| `conversions14d` | `orders` |
| `sales14d` | `revenue` |
| `acos14d` | `acos` |
| `ctr` | `ctr` |
| `averageCpc` | `cpc` |
| `conversionRate14d` | `conversion_rate` |

Daarnaast beschikbaar en nu niet opgeslagen: `directConversions14d`,
`indirectConversions14d`, `roas14d`, en bij zoektermen `searchVolume`,
`impressionShare`, `clickShare`, `averageWinningBid`.

> **Alle conversiemetrieken zijn `14d`.** Een klik van vandaag kan tot veertien dagen
> later nog een conversie opleveren: de cijfers van een dag staan pas na twee weken
> vast. Daarom haalt `ads-bolcom-reports` standaard de laatste zeven dagen opnieuw op
> in plaats van alleen gisteren. Dat werkt alleen omdat de upsert bestaande dagen
> bijwerkt — zie de unieke indexen in migratie `20260911130000`.

---

## 4. Wat nog open staat

- **Een test- of demo-omgeving.** Niet gevonden in de documentatie. Zolang die er niet
  is, raakt elke verificatie de productie-API — dus: bouwen tegen het contract,
  deployen, en wachten op de reguliere cron in plaats van handmatig vuren.
- **De vorm van `entity-ids` is nog onbewezen.** De code herhaalt de parameter
  (`entity-ids=1&entity-ids=2`), wat de OpenAPI-standaard voor een array-queryparameter
  is. De 406 kwam vóór enige validatie daarvan, dus of bol.com deze vorm accepteert
  blijkt pas bij de eerstvolgende run. Komt daar een 400, dan is komma-gescheiden de
  volgende kandidaat.
- **Rate limits en dagquota.** Niet uit deze specs af te lezen. De 429-afhandeling met
  `Retry-After` blijft daarom staan.
- **De Bulk Reporting API** is niet bekeken; bij groei mogelijk efficiënter dan
  per-entiteit rapporteren.

# Bol.com Advertising API v11 — de juiste contracten

**Datum:** 11 september 2026
**Bron:** de officiële OpenAPI-specificaties, gelezen via de documentatiebrowser:

- `https://api.bol.com/advertiser/docs/specs/sponsored-products/v11/campaign-management.yml`
- `https://api.bol.com/advertiser/docs/specs/sponsored-products/v11/reporting.yml`

> **Er is geen enkele aanroep naar de bol.com-API gedaan om dit te achterhalen.** Alles komt
> uit de gepubliceerde specificaties. Dat is bewust: de API ligt gevoelig, dus de herbouw
> gebeurt tegen het contract en niet door te proberen.

**Aanleiding:** van de zeven bol.com-aanroepen in `ads-bolcom-sync` en `ads-bolcom-reports`
werkte er precies één. Zie `docs/role-audit.md` (ADS-REPORTS-1) voor het spoor.

---

## 1. Wat er misgaat, in één tabel

| Onze aanroep | Werkelijk contract | Status |
|---|---|---|
| `POST campaign-management/campaigns/list` | idem | ✅ **klopt** |
| `GET campaign-management/campaigns/{id}/ad-groups` | `POST campaign-management/ad-groups/list` | ❌ 404 |
| `GET campaign-management/ad-groups/{id}/keywords` | `POST campaign-management/keywords/list` | ❌ nooit bereikt |
| `GET campaign-management/ad-groups/{id}/target-products` | `POST campaign-management/target-products/list` | ❌ nooit bereikt |
| `POST insights/campaigns` | `GET reporting/performance` | ❌ 404 — pad bestaat niet |
| `POST insights/search-terms` | `GET reporting/performance/search-term` | ❌ 400 — verkeerde API |
| `POST insights/keywords` | `GET reporting/performance` met `entity-type=KEYWORD` | ❌ nooit bereikt |

**De twee patronen die we fout hadden:**

1. **Lezen gebeurt met `POST /{resource}/list`,** niet met een `GET` op een genest pad. Dat is
   waarom `campaigns/list` als enige werkt — dat is per toeval de juiste vorm.
2. **Rapportage zit in een eigen API** (`reporting`) met **GET** en query-parameters. De
   `insights`-API waar wij op mikten is iets anders: die geeft gemiddelde winnende biedingen
   voor zoektermen die jíj aanlevert.

---

## 2. Campaign Management API

**Basis:** `https://api.bol.com/advertiser/sponsored-products/campaign-management`

Alle lees-endpoints zijn `POST …/list` met dezelfde vorm:

```json
{
  "filter": {
    "campaignIds": ["1000000001348050"],
    "states": ["ENABLED", "PAUSED"]
  },
  "page": 1,
  "pageSize": 50
}
```

| Endpoint | operationId | Filtervelden |
|---|---|---|
| `POST /campaigns/list` | `getCampaigns` | `campaignIds`, `states` |
| `POST /ad-groups/list` | `getAdGroups` | `adGroupIds`, `campaignIds`, `states` |
| `POST /keywords/list` | `getKeywords` | — |
| `POST /target-products/list` | `getTargetProduct` | — |
| `POST /ads/list` | `getAds` | — |
| `POST /negative-keywords/list` | `getNegativeKeywords` | — |
| `POST /target-categories/list` | `getCategories` | — |
| `POST /expressions/list` | `getExpression` | — |

> **ID's zijn strings, geen getallen.** De voorbeelden in de spec tonen `"12345"` met
> aanhalingstekens. `ads-bolcom-reports` doet nu `bolCampaignIds.map(Number)` — dat moet weg.

**Limieten** (uit de functionele documentatie): 10 ad groups per campagne, 5000 ads per ad
group, 100 keywords per ad group, 30 target products per ad group. Een create/update-verzoek
accepteert maximaal 150 ad groups; daarboven volgt HTTP 400.

---

## 3. Reporting API

**Basis:** `https://api.bol.com/advertiser/sponsored-products/reporting`

**Methode is GET met query-parameters** — geen POST met een body.

### `GET /performance`

| Parameter | Verplicht | Waarde |
|---|---|---|
| `entity-type` | ja | `CAMPAIGN` \| `AD_GROUP` \| `AD` \| `KEYWORD` \| `TARGET_CATEGORY` \| `TARGET_PRODUCT` |
| `entity-ids` | ja | array, **1 t/m 100 items** |
| `period-start-date` | ja | `YYYY-MM-DD` |
| `period-end-date` | ja | `YYYY-MM-DD` |

> **Maximaal 30 dagen terug.** De spec: *"can be set to a value representing today or any
> date within the last 30 days period."* Onze huidige code vraagt precies 30 dagen — dat zit
> op de grens en kan per tijdzone net buiten vallen. Neem 29 dagen.

Eén endpoint dekt campagne-, ad-group- én keyword-performance; alleen `entity-type` verschilt.
Dat vervangt twee van onze drie kapotte aanroepen in één keer.

### `GET /performance/search-term`

| Parameter | Verplicht | Waarde |
|---|---|---|
| `ad-group-ids` | ja | array van ad-group-ID's |
| `period-start-date` / `period-end-date` | ja | `YYYY-MM-DD` |
| `page` / `page-size` | nee | paginering |

### Overige

`GET /performance/advertiser` (accountniveau), `GET /performance/target-page` (uitgesplitst
naar `SEARCH` / `CATEGORY` / `PDP`, op ad-group-niveau) en `GET /performance/category`.

---

## 4. De volgorde van de herbouw ligt vast

Er zit een harde afhankelijkheid in, en die bepaalt alles:

> **`/performance/search-term` werkt op ad-group-niveau en verlangt `ad-group-ids`.**
> Wij hebben nul ad groups, omdat precies die sync-aanroep kapot is.

Daarom:

1. **Eerst `ads-bolcom-sync` repareren** — `POST /ad-groups/list` met `filter.campaignIds`.
   Zonder ad groups is er geen keyword-sync, geen target-product-sync én geen
   zoekterm-rapportage.
2. **Dan keywords en target-products**, ook via hun `…/list`-endpoints.
3. **Dan `ads-bolcom-reports` herbouwen** op `reporting/performance` met `entity-type`. Begin
   met `CAMPAIGN` — dat werkt zonder ad groups en levert meteen de eerste echte cijfers.
4. **Als laatste de zoektermen**, want die hebben stap 1 nodig.

**Niet vergeten:** `ADV_HEADERS` gebruikt nu `application/vnd.advertiser.v11+json`. Dat is
niet geverifieerd tegen de reporting-API; controleer het in de spec vóór de eerste aanroep.

---

## 5. Wat nog open staat

- **Een test- of demo-omgeving.** Niet gevonden in de documentatie. Zolang die er niet is,
  raakt elke verificatie de productie-API — dus: bouwen tegen het contract, deployen, en
  wachten op de reguliere cron in plaats van handmatig vuren.
- **Rate limits en dagquota.** Niet uit deze twee specs af te lezen. Relevant omdat
  `entity-ids` op 100 per verzoek staat: bij meer campagnes zijn meerdere aanroepen nodig.
  De bestaande 429-afhandeling met `Retry-After` blijft dus nodig.
- **De Bulk Reporting API** (`/retailer/public/redoc/v11/advertising-bulk-reporting.html`)
  is niet bekeken. Bij groei kan die efficiënter zijn dan per-entiteit rapporteren.

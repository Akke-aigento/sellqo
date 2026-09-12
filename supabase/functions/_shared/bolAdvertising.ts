// Eén toegangspad tot de bol.com Advertising API v11.
//
// Waarom dit bestaat: `ads-bolcom-sync` en `ads-bolcom-reports` hadden allebei een
// eigen kopie van getBolToken, bolGet, bolPost, ADV_HEADERS en withRetry — vrijwel
// regel voor regel identiek. Die duplicatie is hoe de twee uit elkaar konden lopen
// zonder dat iets het meldde.
//
// De contracten hieronder komen uit de officiële OpenAPI-specificaties, niet uit
// experimenten tegen productie. Zie docs/bol-advertising-api-v11.md. Dat is bewust:
// de API ligt gevoelig, dus er wordt tegen het contract gebouwd en niet geprobeerd.
//
// De twee patronen die de oude code fout had:
//   1. Lezen gaat met POST /{resource}/list, niet met een GET op een genest pad.
//      `campaigns/{id}/ad-groups` en `ad-groups/{id}/keywords` bestaan niet.
//   2. Rapportage zit in een eigen API (reporting) met GET en query-parameters.
//      De insights-API waar de oude code op mikte is iets anders: die geeft
//      gemiddelde winnende biedingen voor zoektermen die je zelf aanlevert.

const BOL_TOKEN_URL = "https://login.bol.com/token";

export const BOL_CAMPAIGN_BASE =
  "https://api.bol.com/advertiser/sponsored-products/campaign-management";
export const BOL_REPORTING_BASE =
  "https://api.bol.com/advertiser/sponsored-products/reporting";

// Eén mediatype voor beide API's, en dat is met een 406 betaald.
//
// Op 11 september stond hier `application/json` voor reporting, omdat reporting.yml
// in élk `content:`-blok alleen dat declareert. Dat was een verkeerde lezing: zo'n
// blok beschrijft het formaat van de *response body*, niet de Accept-header die de
// gateway van bol.com eist. Elke reporting-aanroep kreeg:
//
//   406 — "Accept headers are required (e.g. 'application/vnd.retailer.{version}+json').
//          No wildcards allowed i.e. '*/*', 'application/*', '*/json'."
//
// De gateway wil dus altijd een vendor-mediatype. Voor de advertiser-API is dat
// `vnd.advertiser.v11+json` — aantoonbaar goed, want daarmee werkt
// campaign-management al. (Het voorbeeld in de foutmelding noemt `vnd.retailer`;
// dat is de generieke tekst van de gateway, niet het type voor deze API.)
//
// Les: een OpenAPI-`content:`-blok is geen uitspraak over de Accept-header.
const ADV_MEDIA_TYPE = "application/vnd.advertiser.v11+json";

/** pageSize mag volgens de spec hoogstens 100 zijn. */
export const BOL_MAX_PAGE_SIZE = 100;
/** entity-ids accepteert minimaal 1 en hoogstens 100 waarden per verzoek. */
export const BOL_MAX_ENTITY_IDS = 100;
/**
 * De spec staat een periode toe "representing today or any date within the last 30
 * days". 30 is dus de bovengrens, en die is over een tijdzonegrens net te krap:
 * de edge function rekent in UTC, bol.com hanteert Europe/Amsterdam. 29 houdt een
 * dag marge zonder dat er data verloren gaat — de cron draait dagelijks.
 */
export const BOL_MAX_REPORT_DAYS = 29;

export type BolEntityType =
  | "CAMPAIGN"
  | "AD_GROUP"
  | "AD"
  | "KEYWORD"
  | "TARGET_CATEGORY"
  | "TARGET_PRODUCT";

// De vormen hieronder komen één op één uit de v11-specificaties. Ze staan hier
// zodat het contract in code vastligt in plaats van in losse veldnamen verspreid
// door twee edge functions — precies hoe `kw.text` en `tp.ean` konden blijven staan
// voor velden die niet bestaan.

/** `POST /campaigns/list` → `campaigns[]`. */
export interface BolCampaign {
  campaignId: string;
  name?: string;
  state?: string;
  /** `AUTO` (bol.com kiest de zoekwoorden) of `MANUAL`. Dit is de targeting. */
  campaignType?: string;
  dailyBudget?: { amount?: number };
  totalBudget?: { amount?: number };
  startDate?: string;
  endDate?: string;
}

/** `POST /ad-groups/list` → `adGroups[]`. Kent géén eigen bod. */
export interface BolAdGroup {
  adGroupId: string;
  campaignId: string;
  name?: string;
  state?: string;
  targetPages?: string[];
}

/** `POST /keywords/list` → `keywords[]`. Let op `keywordText`, niet `text`. */
export interface BolKeyword {
  keywordId?: string;
  adGroupId: string;
  campaignId?: string;
  keywordText?: string;
  matchType?: string;
  state?: string;
  bid?: { amount?: number; currency?: string };
}

/** `POST /ads/list` → `ads[]`. Dit is het geadverteerde artikel, mét EAN. */
export interface BolAd {
  adId?: string;
  adGroupId: string;
  campaignId?: string;
  ean?: string;
  state?: string;
}

/**
 * Eén regel uit een reporting-antwoord.
 *
 * Er zit bewust géén `date` in: de API aggregeert over de opgevraagde periode en
 * splitst per entiteit, niet per dag. Dagcijfers vergen één aanroep per dag.
 */
export interface BolPerformanceRow {
  entityType?: string;
  entityId?: string;
  campaignId?: string;
  adGroupId?: string;
  keywordId?: string;
  searchTerm?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number | null;
  conversions14d?: number;
  conversionRate14d?: number | null;
  averageCpc?: number | null;
  sales14d?: number;
  cost?: number;
  acos14d?: number | null;
  roas14d?: number | null;
}

/** `GET /performance` en `GET /performance/search-term`. */
export interface BolPerformanceResponse {
  entityCount?: number;
  total?: BolPerformanceRow;
  subTotals?: BolPerformanceRow[];
}

/** Een JSON-object waarvan de vorm per aanroep verschilt. */
export type BolJson = Record<string, unknown>;

/** Haalt een leesbare melding uit iets dat gevangen is in een catch. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Gegooid bij HTTP 429. `retryAfter` is in seconden. */
export class BolRateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`RATE_LIMITED:${retryAfter}`);
    this.name = "BolRateLimitError";
  }
}

export class BolApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    // Niet inkorten tot 300 tekens: de violations-array van bol.com staat achteraan
    // en juist die zegt wát er precies ongeldig is. Dat kostte een diagnoseronde.
    super(`Bol API (${status}): ${body.substring(0, 1200)}`);
    this.name = "BolApiError";
  }
}

async function fetchToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(BOL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

async function handle(res: Response): Promise<unknown> {
  const text = await res.text();
  if (res.status === 429) {
    throw new BolRateLimitError(parseInt(res.headers.get("Retry-After") || "60", 10));
  }
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok && res.status !== 207) throw new BolApiError(res.status, text);
  return text ? JSON.parse(text) : null;
}

export interface BolAdvertisingClient {
  /** POST met JSON-body — campaign-management. */
  post<T = BolJson>(base: string, path: string, body: unknown): Promise<T | null>;
  /** GET met query-parameters — reporting. */
  get<T = BolJson>(base: string, path: string, params: URLSearchParams): Promise<T | null>;
}

/**
 * Bouwt een client die zijn eigen token vernieuwt.
 *
 * Een verlopen token geeft 401; dat wordt één keer opgevangen met een vers token en
 * een herhaling. Blijft het 401, dan gaat de fout door naar de aanroeper — anders
 * verbergt een oneindige lus een echt rechtenprobleem.
 */
export function createBolAdvertisingClient(
  clientId: string,
  clientSecret: string,
): BolAdvertisingClient {
  let token: string | null = null;

  const withFreshToken = async (attempt: (t: string) => Promise<Response>) => {
    if (!token) token = await fetchToken(clientId, clientSecret);
    try {
      return await handle(await attempt(token));
    } catch (e) {
      if (e instanceof Error && e.message === "TOKEN_EXPIRED") {
        token = await fetchToken(clientId, clientSecret);
        return await handle(await attempt(token));
      }
      throw e;
    }
  };

  return {
    async post(base, path, body) {
      const url = `${base}${path}`;
      console.log(`POST ${url}`);
      return await withFreshToken((t) =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
            Accept: ADV_MEDIA_TYPE,
            "Content-Type": ADV_MEDIA_TYPE,
          },
          body: JSON.stringify(body),
        })
      ) as T | null;
    },

    async get(base, path, params) {
      const url = `${base}${path}?${params.toString()}`;
      console.log(`GET ${url}`);
      // Bewust géén Content-Type: een GET heeft geen body, en een Content-Type
      // zonder body wordt door sommige gateways geweigerd. De oude code stuurde
      // hem wel mee, omdat GET en POST dezelfde header-constante deelden.
      return await withFreshToken((t) =>
        fetch(url, {
          headers: { Authorization: `Bearer ${t}`, Accept: ADV_MEDIA_TYPE },
        })
      ) as T | null;
    },
  };
}

/**
 * Doorloopt een `POST /{resource}/list`-endpoint tot de laatste pagina.
 *
 * @param pluck haalt de lijst uit het antwoord — de sleutel verschilt per resource
 *              (`campaigns`, `adGroups`, `keywords`, `targetProducts`).
 */
export async function listAllPages<T>(
  client: BolAdvertisingClient,
  path: string,
  filter: Record<string, unknown>,
  pluck: (res: BolJson | null) => T[] | undefined,
): Promise<T[]> {
  const out: T[] = [];
  // Bovengrens tegen een eindeloze lus als bol.com ooit blijft doorpagineren:
  // 100 pagina's à 100 items is 10.000 entiteiten, ruim boven elke reële limiet
  // (10 ad groups per campagne, 100 keywords per ad group).
  const MAX_PAGES = 100;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await client.post(BOL_CAMPAIGN_BASE, path, {
      filter,
      page,
      pageSize: BOL_MAX_PAGE_SIZE,
    });
    const batch = pluck(res) ?? [];
    out.push(...batch);
    if (batch.length < BOL_MAX_PAGE_SIZE) break;
  }
  return out;
}

/** Knipt een lijst in blokken — `entity-ids` mag er hoogstens 100 tegelijk. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `YYYY-MM-DD`, het formaat dat de reporting-API verlangt. */
export function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Bouwt de query voor `GET /performance`.
 *
 * `entity-ids` wordt herhaald in plaats van komma-gescheiden: de spec typeert het als
 * een array, en dat is de vorm die OpenAPI daarvoor voorschrijft.
 */
export function performanceParams(
  entityType: BolEntityType,
  entityIds: string[],
  startDate: string,
  endDate: string,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("entity-type", entityType);
  for (const id of entityIds) params.append("entity-ids", id);
  params.set("period-start-date", startDate);
  params.set("period-end-date", endDate);
  return params;
}

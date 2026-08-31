// BILLING-1: gedeelde datumrekenkunde voor de billing-keten.
//
// Vervangt drie eigen kopieën die alle drie `setUTCMonth` gebruikten. Dat is de
// kapotte overloop: `2026-01-31` + 1 maand geeft in JavaScript `2026-03-03`,
// want de 31e van februari rolt gewoon door naar maart. Een abonnement dat op
// de 31e start, schuift daardoor elk jaar dagen op.
//
// Twee regels maken dat goed:
//   1. CLAMP — de doeldag is nooit hoger dan het aantal dagen in de doelmaand.
//   2. ANCHOR — de *bedoelde* factuurdag wordt apart meegegeven, zodat een
//      abonnement dat in februari naar de 28e geklemd werd in maart terugkeert
//      naar de 31e in plaats van daar te blijven hangen.
//
// De maandrekening loopt via een absolute maandindex (y*12 + (m-1) + months),
// nooit via een Date-mutatie, zodat jaaroverloop vanzelf klopt.

/** Brede intervalnotatie. `planProration.Interval` ("monthly" | "yearly") blijft
 *  daar de smalle bron van waarheid; deze helper accepteert ook de intervallen
 *  die `subscriptions.interval` toestaat (weekly / quarterly), plus "annual". */
export type BillingInterval = string;

const PURE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * BILLING-1 bug 4: een timestamp die als datum binnenkomt.
 * `"2026-07-29T17:06:03Z".split("-").map(Number)` geeft [2026, 7, NaN], en
 * `new Date(NaN).toISOString()` gooit een RangeError diep in de facturatielus,
 * waar hij als generieke `summary.failed`-regel eindigt. Aan de poort gooien
 * levert een leesbare fout op die de aanroeper aanwijst.
 */
function assertPureDate(value: string, fn: string): void {
  if (typeof value !== "string" || !PURE_DATE.test(value)) {
    throw new Error(
      `${fn}: verwacht een pure datum YYYY-MM-DD, kreeg ${JSON.stringify(value)}. ` +
        `Snij een timestamp eerst af met .slice(0, 10).`,
    );
  }
}

/** Aantal dagen in een maand. Dag 0 van de volgende maand = laatste dag van deze. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

const pad = (n: number, len: number) => String(n).padStart(len, "0");

/**
 * Een anchor buiten 1-31 (of niet-eindig) wordt genegeerd in plaats van
 * gegooid: de DB-CHECK op `subscriptions.billing_anchor_day` sluit dit al uit,
 * en een facturatierun mag hier niet op omvallen. Zonder anchor is de dag van
 * `from` de bedoelde dag — precies het oude gedrag.
 */
function resolveAnchor(anchorDay: number | null | undefined, fallbackDay: number): number {
  const a = Number(anchorDay);
  if (!Number.isFinite(a) || a < 1 || a > 31) return fallbackDay;
  return Math.trunc(a);
}

/** Verschuif `months` maanden vanaf `from`, met clamp op de doelmaand. */
function shiftMonths(from: string, months: number, anchorDay?: number | null): string {
  const [y, m, d] = from.split("-").map(Number);
  // Absolute maandindex: geen setUTCMonth, dus geen doorrol-overloop.
  const abs = y * 12 + (m - 1) + months;
  // Floor-deling, zodat ook negatieve indices (retreatDate) kloppen.
  const targetYear = Math.floor(abs / 12);
  const targetMonthIndex = abs - targetYear * 12;
  const wanted = resolveAnchor(anchorDay, d);
  const day = Math.min(wanted, daysInMonth(targetYear, targetMonthIndex));
  return `${pad(targetYear, 4)}-${pad(targetMonthIndex + 1, 2)}-${pad(day, 2)}`;
}

/** Verschuif `days` kalenderdagen. Weekly kent geen maandclamp. */
function shiftDays(from: string, days: number): string {
  const [y, m, d] = from.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Aantal maanden dat één `count` van dit interval waard is; 0 = dagen-interval. */
function monthsPerInterval(interval: BillingInterval): number {
  switch (String(interval || "monthly").toLowerCase()) {
    case "weekly":
      return 0;
    case "quarterly":
      return 3;
    case "yearly":
    case "annual":
      // Bewust via het maandenpad: zo krijgt 29 februari dezelfde clamp
      // (2028-02-29 + 1 jaar = 2029-02-28) in plaats van door te rollen.
      return 12;
    case "monthly":
    default:
      return 1;
  }
}

/**
 * Tel `count` intervallen op bij `from`.
 *
 * @param from      pure datum YYYY-MM-DD (gooit anders)
 * @param interval  weekly | monthly | quarterly | yearly | annual (default monthly)
 * @param count     aantal intervallen, default 1
 * @param anchorDay bedoelde factuurdag 1-31; zonder anchor telt de dag van `from`
 */
export function advanceDate(
  from: string,
  interval: BillingInterval,
  count = 1,
  anchorDay?: number | null,
): string {
  assertPureDate(from, "advanceDate");
  const n = Number(count);
  const steps = Number.isFinite(n) ? Math.trunc(n) : 1;
  const months = monthsPerInterval(interval);
  return months === 0 ? shiftDays(from, 7 * steps) : shiftMonths(from, months * steps, anchorDay);
}

/** Spiegelbeeld van {@link advanceDate}: `count` intervallen terug. */
export function retreatDate(
  from: string,
  interval: BillingInterval,
  count = 1,
  anchorDay?: number | null,
): string {
  assertPureDate(from, "retreatDate");
  const n = Number(count);
  const steps = Number.isFinite(n) ? Math.trunc(n) : 1;
  const months = monthsPerInterval(interval);
  return months === 0 ? shiftDays(from, -7 * steps) : shiftMonths(from, -months * steps, anchorDay);
}

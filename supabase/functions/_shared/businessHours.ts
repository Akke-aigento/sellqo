// UREN-1 — openingsuren van de zaak (tabel business_hours), voor storefront-api.
// Pure functies zonder databank. Vorm van een weekschema: zoals fulfillment_settings.hours per soort,
// { "1": [["11:30","14:00"],["17:30","22:00"]], ... } (0 = zondag). Een blok met "tot" vóór "van"
// loopt door tot na middernacht (bv. ["20:00","02:00"]).
// Uitzonderlijke sluitingsdagen: [{ from: "2026-12-24", to: "2026-12-26", reason: "Kerstvakantie" }].

export type Week = Record<string, [string, string][]>;
export interface Closure { from: string; to: string; reason?: string | null }
export interface BusinessHoursRow { week?: unknown; closures?: unknown; timezone?: string | null }
export type HoursMode = 'business' | 'own';

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Enkel geldige dagen en blokken; al de rest valt weg. */
export function parseWeek(raw: unknown): Week {
  const out: Week = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [d, ranges] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(d) || !Array.isArray(ranges)) continue;
    const ok = ranges.filter((r): r is [string, string] => Array.isArray(r) && r.length === 2 && HM.test(String(r[0])) && HM.test(String(r[1])) && r[0] !== r[1]);
    if (ok.length) out[d] = ok.map(([a, b]) => [a, b]);
  }
  return out;
}

export function parseClosures(raw: unknown): Closure[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Closure => !!c && typeof c === 'object' && DATE.test(String((c as Closure).from)) && DATE.test(String((c as Closure).to)) && (c as Closure).to >= (c as Closure).from)
    .map((c) => ({ from: c.from, to: c.to, reason: typeof c.reason === 'string' && c.reason.trim() ? c.reason.trim().slice(0, 80) : null }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** Staat er minstens één uurblok in? (een leeg schema = niets ingevuld) */
export function weekHasRanges(week: unknown): boolean {
  if (!week || typeof week !== 'object') return false;
  return Object.values(week as Record<string, unknown>).some((r) => Array.isArray(r) && r.some((x) => Array.isArray(x) && x.length === 2));
}

/**
 * Welke uren gelden voor afhalen, leveren of online reserveren? Een expliciete keuze wint; zonder keuze
 * (NULL, bestaande zaken) houden zaken met eigen uren die, en volgen zaken zonder eigen uren de openingsuren.
 */
export function resolveHoursMode(mode: unknown, ownWeek: unknown): HoursMode {
  if (mode === 'business' || mode === 'own') return mode;
  return weekHasRanges(ownWeek) ? 'own' : 'business';
}

// UREN-1c — een blok over middernacht hoort bij zijn startdag: is die dag gesloten, dan vervalt het hele blok
// (ook het deel na middernacht); is enkel de volgende dag gesloten, dan blijft het deel na middernacht staan.
// Daarom wordt het weekschema niet meer in kalenderdagen gesplitst (splitOvernight, UREN-1): computeSlots en
// openState lezen "tot" vóór "van" zelf als "tot na middernacht" en toetsen de sluiting op de startdag. Zelfde
// regel in reservation_slots (SQL) en op de site (sellqo-storefront src/lib/hours.ts).

export const DEFAULT_TZ = 'Europe/Brussels';

/** Een tijdzone die Intl kent; anders Europe/Brussels. Een foute waarde mag nooit get_config laten falen. */
export function safeTz(tz: unknown): string {
  if (typeof tz !== 'string' || !tz.trim()) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Eén bron voor de tijdzone: business_hours.timezone, dan fulfillment_settings.timezone, dan Europe/Brussels. */
export function hoursTimezone(bhTz: unknown, fulfillmentTz?: unknown): string {
  if (typeof bhTz === 'string' && bhTz.trim()) return safeTz(bhTz);
  return safeTz(fulfillmentTz);
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Alle kalenderdagen (YYYY-MM-DD) van de sluitingen die vallen tussen `fromYmd` en `days` dagen later. */
export function closureDates(closures: Closure[], fromYmd: string, days: number): string[] {
  if (!DATE.test(fromYmd)) return [];
  const [y, m, d] = fromYmd.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i <= Math.max(0, days); i++) {
    const day = ymd(new Date(Date.UTC(y, m - 1, d + i, 12)));
    if (closures.some((c) => day >= c.from && day <= c.to)) out.push(day);
  }
  return out;
}

/** Lokale datum (YYYY-MM-DD) van `ms` in `tz` (onbekende tijdzone: Europe/Brussels). */
export function localYmd(ms: number, tz: string): string {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, ...opts }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, ...opts }).format(new Date(ms));
  }
}

/** YYYY-MM-DD plus n kalenderdagen. */
export function addDaysYmd(ymdStr: string, n: number): string {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return ymd(new Date(Date.UTC(y, m - 1, d + n, 12)));
}

/**
 * Publiek veld `business_hours` van get_config (en dus get_storefront_bundle). `null` als de zaak niets
 * invulde (geen uren én geen komende sluitingen), zodat een site dan niets toont.
 * closures: enkel wat nog niet voorbij is, vroegste eerst, hoogstens 10.
 */
export function publicBusinessHours(row: BusinessHoursRow | null | undefined, nowMs: number, tableBlock = false, fulfillmentTz?: string | null) {
  if (!row) return null;
  // UREN-1c: één bron (business_hours, dan fulfillment_settings, dan Brussel) en nooit een onbekende zone naar de site.
  const timezone = hoursTimezone(row.timezone, fulfillmentTz);
  const week = parseWeek(row.week);
  const today = localYmd(nowMs, timezone);
  const closures = parseClosures(row.closures).filter((c) => c.to >= today).slice(0, 10);
  if (!Object.keys(week).length && !closures.length) return null;
  // UREN-1b: 'block' = bestellen aan tafel (QR) kan enkel binnen de openingsuren; de site toont dat vooraf.
  return { timezone, week, closures, table_ordering_when_closed: tableBlock ? 'block' : 'allow' };
}

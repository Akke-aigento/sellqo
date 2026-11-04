// FOOD-1 — tijdsloten voor afhalen en leveren (pizzeria, frituur, bakker, traiteur).
// Pure functies zonder databank: de storefront-api telt de bestaande bestellingen per
// slot en geeft die mee. Tijden worden in de tijdzone van de winkel gerekend.
import { addDaysYmd, closureDates, hoursTimezone, localYmd, parseClosures, parseWeek, resolveHoursMode, safeTz, type BusinessHoursRow } from './businessHours.ts';

export type ServiceType = 'pickup' | 'local_delivery';
export interface FulfillmentSettings {
  slots_enabled: boolean;
  slot_minutes: number;
  prep_minutes: number;
  days_ahead: number;
  max_orders_per_slot: number | null;
  timezone: string;
  /** { pickup: { "0": [["17:00","22:00"]], ... }, local_delivery: {...} }  (0 = zondag) */
  hours: Record<string, Record<string, [string, string][]>>;
  /** PAUSE-1: geen sloten vóór dit moment (druk in de keuken). */
  paused_until?: string | null;
  /** PAUSE-1: lokale datums (YYYY-MM-DD) waarop de zaak dicht is. */
  closed_dates?: string[] | null;
  /**
   * UREN-1c: soorten waarvan de uren de openingsuren zijn (withBusinessHours); daar loopt een blok met "tot"
   * vóór "van" door tot na middernacht. Eigen uren (FOOD-1) kennen dat niet: zo'n blok blijft ongeldig.
   */
  overnight_types?: ServiceType[];
}
export interface Slot { start: string; date: string; label: string; available: boolean }

// Verschil (minuten) tussen de lokale klok in `tz` en UTC op moment `utcMs`.
function offsetMinutes(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** Lokale datum/tijd in `tz` → UTC-milliseconden (ook rond zomertijd correct). */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ms = guess - offsetMinutes(guess, tz) * 60000;
  ms = guess - offsetMinutes(ms, tz) * 60000;
  return ms;
}

/** Lokale kalenderdag (jaar, maand, dag, weekdag) van `utcMs` in `tz`. */
export function localDay(utcMs: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, weekday: wd };
}

const hm = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  return m ? Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2])) : null;
};
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Alle tijdsloten voor `type` vanaf `nowMs` tot en met `days_ahead` dagen later.
 * `counts`: aantal bestaande bestellingen per slot (sleutel = ISO-start).
 * UREN-1c: een blok met "tot" vóór "van" loopt door tot na middernacht en hoort bij zijn startdag: een
 * sluitingsdag (closed_dates) op de startdag schrapt het hele blok, een sluitingsdag op de dag erna niet.
 */
export function computeSlots(s: FulfillmentSettings, type: ServiceType, nowMs: number, counts: Record<string, number> = {}): Slot[] {
  const tz = safeTz(s.timezone);
  const step = Math.max(5, Math.min(120, Number(s.slot_minutes) || 15));
  const pausedMs = s.paused_until ? new Date(s.paused_until).getTime() : NaN;
  const earliest = Math.max(nowMs + Math.max(0, Number(s.prep_minutes) || 0) * 60000, Number.isFinite(pausedMs) ? pausedMs : 0);
  const closed = new Set(s.closed_dates || []);
  const days = Math.max(0, Math.min(14, Number(s.days_ahead) || 0));
  const week = s.hours?.[type] || {};
  const overnight = !!s.overnight_types?.includes(type);
  const out: Slot[] = [];
  const today = localDay(nowMs, tz);
  // Vanaf gisteren (i = -1): de staart na middernacht van een blok dat gisteren begon.
  for (let i = -1; i <= days; i++) {
    // Kalenderdag i dagen verder (niet "+24u": rond zomertijd zou dat een dag overslaan).
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12));
    const day = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate(), weekday: cal.getUTCDay() };
    // Startdag gesloten: het hele blok vervalt, ook het deel na middernacht.
    if (closed.has(`${day.y}-${pad(day.m)}-${pad(day.d)}`)) continue;
    const ranges = week[String(day.weekday)] || [];
    for (const [from, to] of ranges) {
      const a = hm(from); let b = hm(to);
      if (a == null || b == null || a === b) continue;
      if (b < a) {
        if (!overnight) continue; // eigen uren: ongeldig (FOOD-1)
        b += 24 * 60; // openingsuren over middernacht
      }
      for (let t = a; t + step <= b || t === a && b - a < step; t += step) {
        if (t >= b) break;
        const off = Math.floor(t / 1440); const tt = t % 1440;
        if (i + off < 0 || i + off > days) continue;
        const sc = new Date(Date.UTC(day.y, day.m - 1, day.d + off, 12));
        const sd = { y: sc.getUTCFullYear(), m: sc.getUTCMonth() + 1, d: sc.getUTCDate() };
        const utc = zonedToUtc(sd.y, sd.m, sd.d, Math.floor(tt / 60), tt % 60, tz);
        if (utc < earliest) continue;
        const start = new Date(utc).toISOString();
        const full = !!s.max_orders_per_slot && (counts[start] || 0) >= s.max_orders_per_slot;
        out.push({ start, date: `${sd.y}-${pad(sd.m)}-${pad(sd.d)}`, label: `${pad(Math.floor(tt / 60))}:${pad(tt % 60)}`, available: !full });
      }
    }
  }
  // Dubbele (overlappende openingsuren) eruit, op tijd gesorteerd.
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.start) ? false : (seen.add(x.start), true))).sort((x, y) => x.start.localeCompare(y.start));
}

/**
 * PAUSE-1 — kan er nu "zo snel mogelijk" besteld worden (zonder tijdsloten)?
 * Nee als de zaak gepauzeerd is of vandaag een sluitingsdag is. Geeft de reden terug.
 * UREN-1c: met `week` (de uren van die soort) telt een sluitingsdag niet zolang een blok van gisteren nog
 * loopt (een blok hoort bij zijn startdag), zoals de site "Nu open" toont.
 */
export function orderingBlocked(s: Pick<FulfillmentSettings, 'paused_until' | 'closed_dates' | 'timezone'> | null | undefined, nowMs: number,
  week?: Record<string, [string, string][]> | null):
  { reason: 'paused'; until: string } | { reason: 'closed_today' } | null {
  if (!s) return null;
  const until = s.paused_until ? new Date(s.paused_until).getTime() : NaN;
  if (Number.isFinite(until) && until > nowMs) return { reason: 'paused', until: new Date(until).toISOString() };
  const tz = safeTz(s.timezone);
  const d = localDay(nowMs, tz);
  if ((s.closed_dates || []).includes(`${d.y}-${pad(d.m)}-${pad(d.d)}`)) {
    if (week && openState(week, s.closed_dates, tz, nowMs)?.open) return null;
    return { reason: 'closed_today' };
  }
  return null;
}

/** Postcode valt binnen de leverzone? Lege lijst = overal. "30*" of "30" = begint met 30. */
export function postalCodeAllowed(postal: string | null | undefined, list: string[] | null | undefined): boolean {
  if (!list || list.length === 0) return true;
  const pc = String(postal || '').replace(/\s+/g, '').toUpperCase();
  if (!pc) return false;
  return list.some((e) => {
    const x = String(e || '').replace(/\s+/g, '').toUpperCase().replace(/\*$/, '');
    return !!x && pc.startsWith(x);
  });
}

/**
 * UREN-1 — de uren die echt gelden voor afhalen en leveren, en de sluitingsdagen.
 * - Per soort: "zelfde als openingsuren" (pickup_hours_mode / delivery_hours_mode = 'business', of NULL
 *   zonder eigen uren) neemt het weekschema van business_hours over, inclusief blokken over middernacht.
 *   'own' (of NULL mét eigen uren, bestaande zaken) houdt fulfillment_settings.hours.
 * - Sluitingsdagen komen uit business_hours.closures (datum of periode) en gelden voor beide soorten,
 *   ook bij eigen uren: een dichte zaak neemt niets aan. fulfillment_settings.closed_dates (PAUSE-1) is
 *   overgezet naar business_hours en wordt niet meer gelezen.
 * `bh` = null: de zaak vulde geen openingsuren in (dan geen uren voor "zelfde als" en geen sluitingsdagen).
 */
export function withBusinessHours<T extends FulfillmentSettings & { pickup_hours_mode?: string | null; delivery_hours_mode?: string | null }>(
  s: T, bh: BusinessHoursRow | null, nowMs: number,
): T {
  // UREN-1c: niet meer gesplitst; een blok over middernacht blijft "tot" vóór "van" en hoort bij zijn startdag.
  const week = parseWeek(bh?.week);
  const hours: FulfillmentSettings['hours'] = { ...(s.hours || {}) };
  const modes: [ServiceType, string | null | undefined][] = [['pickup', s.pickup_hours_mode], ['local_delivery', s.delivery_hours_mode]];
  const overnight: ServiceType[] = [];
  for (const [type, mode] of modes) {
    if (resolveHoursMode(mode, s.hours?.[type]) === 'business') { hours[type] = week; overnight.push(type); }
  }
  // UREN-1c: één bron voor de tijdzone (business_hours, dan fulfillment_settings, dan Brussel).
  const tz = bh ? hoursTimezone(bh.timezone, s.timezone) : safeTz(s.timezone);
  // Vanaf gisteren (de staart van een blok dat gisteren begon), days_ahead is hoogstens 14.
  const closed = closureDates(parseClosures(bh?.closures), addDaysYmd(localYmd(nowMs, tz), -1), 16);
  return { ...s, timezone: tz, hours, closed_dates: closed, overnight_types: overnight };
}

/**
 * UREN-1b — is de zaak (of een soort) nu open volgens een weekschema, en wanneer opent ze weer?
 * `week` mag "tot" vóór "van" bevatten (over middernacht); zo'n blok hoort bij zijn startdag (UREN-1c).
 * `closed`: lokale datums (YYYY-MM-DD) waarop alles dicht is, getoetst op de startdag van elk blok. Een leeg schema geeft `null` (geen regel:
 * zonder uren kan niets geweigerd worden). opens_at: eerste opening binnen 8 dagen, anders null.
 */
export function openState(week: Record<string, [string, string][]> | null | undefined, closed: string[] | null | undefined, tz: string, nowMs: number):
  { open: boolean; opens_at: string | null } | null {
  const w = week || {};
  if (!Object.values(w).some((r) => Array.isArray(r) && r.length)) return null;
  tz = safeTz(tz);
  const shut = new Set(closed || []);
  const today = localDay(nowMs, tz);
  let next: number | null = null;
  for (let i = -1; i <= 8; i++) {
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12));
    const day = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate(), weekday: cal.getUTCDay() };
    if (shut.has(`${day.y}-${pad(day.m)}-${pad(day.d)}`)) continue;
    for (const [from, to] of w[String(day.weekday)] || []) {
      const a = hm(from); let b = hm(to);
      if (a == null || b == null || a === b) continue;
      if (b < a) b += 24 * 60;
      // Uren optellen bij lokale middernacht klopt niet rond zomertijd; per eindpunt apart omrekenen.
      const startMs = zonedToUtc(day.y, day.m, day.d, Math.floor(a / 60), a % 60, tz);
      const endCal = new Date(Date.UTC(day.y, day.m - 1, day.d + Math.floor(b / 1440), 12));
      const endMs = zonedToUtc(endCal.getUTCFullYear(), endCal.getUTCMonth() + 1, endCal.getUTCDate(), Math.floor((b % 1440) / 60), b % 60, tz);
      if (startMs <= nowMs && nowMs < endMs) return { open: true, opens_at: null };
      if (startMs > nowMs && (next == null || startMs < next)) next = startMs;
    }
  }
  return { open: false, opens_at: next == null ? null : new Date(next).toISOString() };
}

const DAY_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
/** "Bestellen kan vanaf 17:30" / "vanaf morgen 11:30" / "vanaf donderdag 11:30" (Nederlands, zoals de andere API-meldingen). */
export function closedMessage(opensAt: string | null, tz: string, nowMs: number): string {
  if (!opensAt) return 'We zijn nu gesloten.';
  tz = safeTz(tz);
  const ms = new Date(opensAt).getTime();
  const at = localDay(ms, tz);
  const today = localDay(nowMs, tz);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
  const diff = Math.round((Date.UTC(at.y, at.m - 1, at.d) - Date.UTC(today.y, today.m - 1, today.d)) / 86400000);
  const when = diff === 0 ? f : diff === 1 ? `morgen ${f}` : `${DAY_NL[at.weekday]} ${f}`;
  return `We zijn nu gesloten. Bestellen kan vanaf ${when}.`;
}

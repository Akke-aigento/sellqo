// FOOD-1 — tijdsloten voor afhalen en leveren (pizzeria, frituur, bakker, traiteur).
// Pure functies zonder databank: de storefront-api telt de bestaande bestellingen per
// slot en geeft die mee. Tijden worden in de tijdzone van de winkel gerekend.

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
 */
export function computeSlots(s: FulfillmentSettings, type: ServiceType, nowMs: number, counts: Record<string, number> = {}): Slot[] {
  const tz = s.timezone || 'Europe/Brussels';
  const step = Math.max(5, Math.min(120, Number(s.slot_minutes) || 15));
  const pausedMs = s.paused_until ? new Date(s.paused_until).getTime() : NaN;
  const earliest = Math.max(nowMs + Math.max(0, Number(s.prep_minutes) || 0) * 60000, Number.isFinite(pausedMs) ? pausedMs : 0);
  const closed = new Set(s.closed_dates || []);
  const days = Math.max(0, Math.min(14, Number(s.days_ahead) || 0));
  const week = s.hours?.[type] || {};
  const out: Slot[] = [];
  const today = localDay(nowMs, tz);
  for (let i = 0; i <= days; i++) {
    // Kalenderdag i dagen verder (niet "+24u": rond zomertijd zou dat een dag overslaan).
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12));
    const day = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate(), weekday: cal.getUTCDay() };
    if (closed.has(`${day.y}-${pad(day.m)}-${pad(day.d)}`)) continue;
    const ranges = week[String(day.weekday)] || [];
    for (const [from, to] of ranges) {
      const a = hm(from); const b = hm(to);
      if (a == null || b == null || b <= a) continue;
      for (let t = a; t + step <= b || t === a && b - a < step; t += step) {
        if (t >= b) break;
        const utc = zonedToUtc(day.y, day.m, day.d, Math.floor(t / 60), t % 60, tz);
        if (utc < earliest) continue;
        const start = new Date(utc).toISOString();
        const full = !!s.max_orders_per_slot && (counts[start] || 0) >= s.max_orders_per_slot;
        out.push({ start, date: `${day.y}-${pad(day.m)}-${pad(day.d)}`, label: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, available: !full });
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
 */
export function orderingBlocked(s: Pick<FulfillmentSettings, 'paused_until' | 'closed_dates' | 'timezone'> | null | undefined, nowMs: number):
  { reason: 'paused'; until: string } | { reason: 'closed_today' } | null {
  if (!s) return null;
  const until = s.paused_until ? new Date(s.paused_until).getTime() : NaN;
  if (Number.isFinite(until) && until > nowMs) return { reason: 'paused', until: new Date(until).toISOString() };
  const d = localDay(nowMs, s.timezone || 'Europe/Brussels');
  if ((s.closed_dates || []).includes(`${d.y}-${pad(d.m)}-${pad(d.d)}`)) return { reason: 'closed_today' };
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

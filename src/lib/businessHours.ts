// UREN-1 — openingsuren van de zaak (tabel business_hours), voor het beheer.
// Eén plek: Instellingen › Bedrijf. Afhalen, leveren en online reserveren kiezen per soort
// "Zelfde als openingsuren" of "Eigen uren". Zelfde vorm als fulfillment_settings.hours per soort:
// { "1": [["11:30","14:00"],["17:30","22:00"]], ... } (0 = zondag); "tot" vóór "van" = tot na middernacht.
// De publieke site krijgt ze via storefront-api (config.business_hours), nooit rechtstreeks.
import { supabase } from '@/integrations/supabase/client';

export type Range = [string, string];
export type Week = Record<string, Range[]>;
export interface Closure { from: string; to: string; reason: string | null }
export interface BusinessHours { week: Week; closures: Closure[]; timezone: string }
export type HoursMode = 'business' | 'own';

export const MAX_RANGES = 3;
export const MAX_REASON = 80;
/** Maandag eerst; sleutel = weekdag zoals in de databank (0 = zondag). */
export const WEEK_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;
export const EMPTY_HOURS: BusinessHours = { week: {}, closures: [], timezone: 'Europe/Brussels' };

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Geldig blok: twee uren "HH:MM", niet gelijk. "tot" vóór "van" mag (over middernacht). */
export const validRange = (r: Range): boolean => HM.test(r[0]) && HM.test(r[1]) && r[0] !== r[1];
export const crossesMidnight = (r: Range): boolean => validRange(r) && r[1] < r[0];

export function parseWeek(raw: unknown): Week {
  const out: Week = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [d, ranges] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(d) || !Array.isArray(ranges)) continue;
    const ok = ranges.filter((r): r is Range => Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && typeof r[1] === 'string');
    if (ok.length) out[d] = ok.map(([a, b]) => [a, b]);
  }
  return out;
}

export function parseClosures(raw: unknown): Closure[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object' && DATE.test(String((c as Closure).from)) && DATE.test(String((c as Closure).to)))
    .map((c) => ({ from: (c as Closure).from, to: (c as Closure).to, reason: typeof (c as Closure).reason === 'string' && (c as Closure).reason ? (c as Closure).reason : null }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** Staat er minstens één uurblok in? */
export function weekHasRanges(week: Week | null | undefined): boolean {
  return !!week && Object.values(week).some((r) => r.length > 0);
}

/** Zelfde regel als storefront-api en reservation_slots: een keuze wint, anders eigen uren ingevuld → 'own'. */
export function resolveHoursMode(mode: unknown, ownWeek: Week | null | undefined): HoursMode {
  if (mode === 'business' || mode === 'own') return mode;
  return weekHasRanges(ownWeek) ? 'own' : 'business';
}

/** Lokale datum van vandaag (YYYY-MM-DD) in de tijdzone van de zaak. */
export function todayYmd(tz = 'Europe/Brussels', now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export type HoursError = 'range' | 'closure_dates' | 'closure_order' | 'closure_reason' | 'too_many';

/** Fouten vóór het bewaren; dezelfde regels als de CHECK-constraints in de databank. */
export function validateHours(h: BusinessHours): HoursError | null {
  for (const ranges of Object.values(h.week)) {
    if (ranges.length > MAX_RANGES) return 'too_many';
    if (ranges.some((r) => !validRange(r))) return 'range';
  }
  for (const c of h.closures) {
    if (!DATE.test(c.from) || !DATE.test(c.to)) return 'closure_dates';
    if (c.to < c.from) return 'closure_order';
    if ((c.reason || '').length > MAX_REASON) return 'closure_reason';
  }
  return null;
}

/** Wat er bewaard wordt: lege dagen weg, voorbije sluitingen weg, reden getrimd. */
export function cleanHours(h: BusinessHours, today: string): BusinessHours {
  const week: Week = {};
  for (const d of WEEK_ORDER) {
    const r = (h.week[d] || []).filter(validRange);
    if (r.length) week[d] = r;
  }
  const closures = h.closures
    .filter((c) => c.to >= today)
    .map((c) => ({ from: c.from, to: c.to, reason: c.reason?.trim() ? c.reason.trim().slice(0, MAX_REASON) : null }))
    .sort((a, b) => a.from.localeCompare(b.from));
  return { week, closures, timezone: h.timezone || 'Europe/Brussels' };
}

/**
 * Compacte weergave per dag, maandag eerst, opeenvolgende dagen met dezelfde uren samen:
 * [{ days: ['1','2','3','4','5'], ranges: [['11:30','14:00']] }, { days: ['0'], ranges: [] }].
 * Lege `ranges` = gesloten.
 */
export function groupWeek(week: Week): { days: string[]; ranges: Range[] }[] {
  const out: { days: string[]; ranges: Range[] }[] = [];
  for (const d of WEEK_ORDER) {
    const ranges = week[d] || [];
    const last = out[out.length - 1];
    if (last && JSON.stringify(last.ranges) === JSON.stringify(ranges)) last.days.push(d);
    else out.push({ days: [d], ranges });
  }
  return out;
}

export async function fetchBusinessHours(tenantId: string): Promise<BusinessHours | null> {
  const { data, error } = await supabase.from('business_hours' as never).select('week, closures, timezone')
    .eq('tenant_id' as never, tenantId as never).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { week: unknown; closures: unknown; timezone: string | null };
  return { week: parseWeek(row.week), closures: parseClosures(row.closures), timezone: row.timezone || 'Europe/Brussels' };
}

/** Bewaart (upsert op tenant_id). Geeft false als RLS weigerde (geen beheerder). */
export async function saveBusinessHours(tenantId: string, h: BusinessHours): Promise<boolean> {
  const clean = cleanHours(h, todayYmd(h.timezone));
  const { data, error } = await supabase.from('business_hours' as never)
    .upsert({ tenant_id: tenantId, week: clean.week, closures: clean.closures } as never, { onConflict: 'tenant_id' })
    .select('tenant_id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

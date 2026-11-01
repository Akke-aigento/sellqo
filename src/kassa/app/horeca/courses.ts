// GANGEN-1 — gangen aan tafel (voorgerecht, hoofdgerecht, dessert). Pure functies.
//
// Geen nieuw fiscaal event: een lijn van een latere gang blijft een ONTWERP-lijn (niet verstuurd, dus geen
// P/ORDER) tot de bediening de gang vrijgeeft. Vrijgeven = dining_checks.course_fired ophogen (commando
// fire_course, niet fiscaal) en die lijnen als gewone ronde versturen (sendRound = P/ORDER zoals altijd).
//
// - Een lijn zonder gang (drank, alles wat naar de bar gaat) wacht nooit.
// - Vrijgegeven = course_fired van de rekening; nog niets vrijgegeven = de laagste gang op de rekening,
//   zodat een tafel die enkel hoofdgerechten bestelt die meteen verstuurt.
import type { Check, CheckLine } from './types';

export const COURSES = [1, 2, 3] as const;
export type Course = (typeof COURSES)[number];
/** Niet ingesteld: hoofdgerecht. */
export const DEFAULT_COURSE: Course = 2;

export interface CourseSettings {
  enabled: boolean;
  /** categorie-id → 0 (geen gang) of 1..3. */
  byCategory: Record<string, number>;
}
export const DEFAULT_COURSE_SETTINGS: CourseSettings = { enabled: false, byCategory: {} };

export function normalizeCourseSettings(row: { courses_enabled?: boolean | null; course_by_category?: unknown } | null | undefined): CourseSettings {
  if (!row) return DEFAULT_COURSE_SETTINGS;
  const raw = row.course_by_category && typeof row.course_by_category === 'object' && !Array.isArray(row.course_by_category)
    ? (row.course_by_category as Record<string, unknown>) : {};
  const byCategory: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 3) byCategory[k] = n;
  }
  return { enabled: row.courses_enabled === true, byCategory };
}

/**
 * Gang voor een nieuw aangetikt product. `active` = de gang die de bediening bovenaan koos (null = automatisch).
 * Drank/bar (of categorie op "geen gang") krijgt nooit een gang, ook niet met een gekozen gang.
 */
export function courseFor(
  s: CourseSettings,
  p: { id: string; category_id: string | null },
  active: Course | null,
  toBar: boolean,
): number | null {
  if (!s.enabled) return null;
  const mapped = p.category_id != null ? s.byCategory[p.category_id] : undefined;
  if (mapped === 0) return null;
  if (mapped === undefined && toBar) return null;
  if (active) return active;
  return mapped ?? DEFAULT_COURSE;
}

const live = (l: CheckLine) => l.state !== 'void' && l.qty > 0 && !l.corrects_line_id;

/** Tot en met welke gang er vrijgegeven is (zonder vrijgave: de laagste gang op de rekening). */
export function firedCourse(c: Pick<Check, 'lines' | 'course_fired'>): number {
  if (c.course_fired) return c.course_fired;
  const courses = c.lines.filter((l) => live(l) && l.course != null).map((l) => l.course as number);
  return courses.length ? Math.min(...courses) : 0;
}

/** Wacht deze lijn op vrijgave? Enkel ontwerp-lijnen met een gang hoger dan wat vrijgegeven is. */
export function isHeld(c: Pick<Check, 'lines' | 'course_fired'>, l: CheckLine, enabled: boolean): boolean {
  return enabled && l.state === 'draft' && live(l) && l.course != null && l.course > firedCourse(c);
}

/** Ontwerp-lijnen die nu mee mogen met "Versturen" (alles behalve wat wacht). */
export function sendableIds(c: Pick<Check, 'lines' | 'course_fired'>, enabled: boolean): Set<string> {
  return new Set(c.lines.filter((l) => l.state === 'draft' && !l.pending && !isHeld(c, l, enabled)).map((l) => l.id));
}

/** De eerstvolgende gang die wacht (voor de knop "Gang … vrijgeven"), of null. */
export function nextHeldCourse(c: Pick<Check, 'lines' | 'course_fired'>, enabled: boolean): number | null {
  const held = c.lines.filter((l) => isHeld(c, l, enabled)).map((l) => l.course as number);
  return held.length ? Math.min(...held) : null;
}

/** Lijnen die meegaan als gang `course` vrijgegeven wordt: alle ontwerp-lijnen tot en met die gang. */
export function releaseIds(c: Pick<Check, 'lines' | 'course_fired'>, course: number): Set<string> {
  return new Set(c.lines.filter((l) => l.state === 'draft' && !l.pending && live(l) && (l.course == null || l.course <= course)).map((l) => l.id));
}

/** Gaat dit product naar een barpost? Zelfde volgorde als de server (product, categorie, standaardpost). */
export function goesToBar(
  data: { stations: { id: string; kind: string; is_default: boolean }[]; routes: { station_id: string; category_id: string | null; product_id: string | null }[] } | undefined,
  p: { id: string; category_id: string | null },
): boolean {
  if (!data) return false;
  const active = new Map(data.stations.map((s) => [s.id, s]));
  const byProduct = data.routes.find((r) => r.product_id === p.id && active.has(r.station_id));
  const byCategory = p.category_id ? data.routes.find((r) => r.category_id === p.category_id && active.has(r.station_id)) : undefined;
  const station = byProduct ? active.get(byProduct.station_id) : byCategory ? active.get(byCategory.station_id) : data.stations.find((s) => s.is_default);
  return station?.kind === 'bar';
}

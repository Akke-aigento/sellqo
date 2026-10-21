// NIGHT-QF-3: een POS-sessie die dagen geleden geopend werd, toonde enkel
// "04:23 PM" en las als "vandaag geopend". Hier: tijd alleen als het vandaag is,
// anders datum + tijd, en een open sessie ouder dan 24 u heet "stale".
import { format, isSameDay, type Locale } from 'date-fns';

export const STALE_OPEN_SESSION_MS = 24 * 60 * 60 * 1000;

/** Open sessie die al langer dan 24 uur openstaat (alleen weergave, er wordt niets aangepast). */
export function isStaleOpenSession(
  session: { status: string; opened_at: string },
  now: Date = new Date(),
): boolean {
  if (session.status !== 'open') return false;
  const opened = new Date(session.opened_at).getTime();
  if (Number.isNaN(opened)) return false;
  return now.getTime() - opened > STALE_OPEN_SESSION_MS;
}

/** Vandaag: enkel de tijd ("16:23"/"4:23 PM"). Andere dag: datum + tijd in de locale. */
export function formatSessionOpenedAt(openedAt: string, locale: Locale, now: Date = new Date()): string {
  const d = new Date(openedAt);
  if (Number.isNaN(d.getTime())) return '';
  return isSameDay(d, now) ? format(d, 'p', { locale }) : format(d, 'PP p', { locale });
}

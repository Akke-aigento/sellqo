/**
 * PROMO-SAFE-1 — "geldig vanaf/tot" van kortingscodes als lokale kalenderdag.
 *
 * Het formulier toont een <input type="date"> (YYYY-MM-DD). Vroeger werd die als
 * new Date('YYYY-MM-DD').toISOString() = middernacht UTC opgeslagen, waardoor een
 * code in België om 01:00/02:00 op de gekozen dag al verliep. storefront-api
 * vergelijkt het moment rechtstreeks (now > new Date(valid_until)), dus we slaan
 * het juiste instant op:
 *   - geldig vanaf = begin van de lokale dag (00:00:00.000 Europe/Brussels)
 *   - geldig tot   = einde van de lokale dag (23:59:59.999 Europe/Brussels)
 * DST-correctie via de bestaande zonedToUtc (identiek aan storefront-api).
 */
import { zonedToUtc, utcToZonedParts } from '@/lib/eventTime';

export const DISCOUNT_TIMEZONE = 'Europe/Brussels';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD (lokale dag) -> ISO-instant van 00:00:00.000 lokale tijd. */
export function localDayStartIso(dateStr: string, timeZone: string = DISCOUNT_TIMEZONE): string | null {
  if (!DATE_RE.test(dateStr)) return null;
  return new Date(zonedToUtc(dateStr, '00:00:00', timeZone)).toISOString();
}

/** YYYY-MM-DD (lokale dag) -> ISO-instant van 23:59:59.999 lokale tijd. */
export function localDayEndIso(dateStr: string, timeZone: string = DISCOUNT_TIMEZONE): string | null {
  if (!DATE_RE.test(dateStr)) return null;
  return new Date(zonedToUtc(dateStr, '23:59:59', timeZone) + 999).toISOString();
}

/** Opgeslagen timestamptz -> YYYY-MM-DD zoals de lokale kalender die dag noemt. */
export function isoToLocalDate(iso: string | null | undefined, timeZone: string = DISCOUNT_TIMEZONE): string | null {
  return utcToZonedParts(iso, timeZone)?.dateStr ?? null;
}

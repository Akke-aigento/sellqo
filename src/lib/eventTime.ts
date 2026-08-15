/**
 * EARLY-BIRD fase D — tijdzone-helpers voor event-tijden.
 *
 * zonedToUtc/tzOffsetMs zijn een 1-op-1 port van supabase/functions/storefront-api/index.ts
 * (r.53-80). IDENTIEKE logica (twee-passes DST-correctie) is essentieel: de early-bird
 * deadline die hier wordt opgeslagen moet exact het moment zijn waar de betaalkant
 * (resolveEventPrice in storefront-api) tegen vergelijkt.
 */

/** Offset (ms) van een tijdzone t.o.v. UTC op een gegeven moment. */
export function tzOffsetMs(utcDate: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(utcDate)) p[part.type] = part.value;
    const asUtc = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour) % 24, Number(p.minute), Number(p.second),
    );
    return asUtc - utcDate.getTime();
  } catch {
    return 0;
  }
}

/** Zet "datum + tijd" in de gegeven tijdzone om naar een UTC-instant (ms). */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = (timeStr || '00:00:00').split(':').map(Number);
  const naive = Date.UTC(y, (m || 1) - 1, d || 1, hh, mm, ss);
  // twee passes voor DST-grenzen
  let offset = tzOffsetMs(new Date(naive), timeZone);
  offset = tzOffsetMs(new Date(naive - offset), timeZone);
  return naive - offset;
}

/** Omgekeerde richting: timestamptz -> lokale datum/tijd-velden voor de pickers. */
export function utcToZonedParts(
  iso: string | null | undefined,
  timeZone: string,
): { dateStr: string; timeStr: string } | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const local = new Date(dt.getTime() + tzOffsetMs(dt, timeZone));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dateStr: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    timeStr: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

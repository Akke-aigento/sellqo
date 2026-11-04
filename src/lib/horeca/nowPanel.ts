// HORECA-NU-1 — pure regels van het Nu-paneel (beheer en kassa), los van React zodat ze testbaar zijn.

/** Lokale datum (YYYY-MM-DD) in de tijdzone van de zaak; onbekende zone: Europe/Brussels (zoals storefront-api). */
export function localYmd(nowMs: number, tz: string | null | undefined): string {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/Brussels', ...opts }).format(new Date(nowMs));
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', ...opts }).format(new Date(nowMs));
  }
}

export interface ClosureLike { from?: unknown; to?: unknown; reason?: unknown }

/**
 * Is de zaak vandaag uitzonderlijk dicht (business_hours.closures)?
 * - `closed`: er staat een sluiting die vandaag dekt;
 * - `single`: een sluiting van precies vandaag (die kan het paneel weer weghalen);
 * - `period`: vandaag valt in een periode van meerdere dagen (die beheer je in Openingsuren, niet hier).
 */
export function closedToday(closures: unknown, today: string): { closed: boolean; single: boolean; period: boolean; reason: string | null } {
  const list = Array.isArray(closures) ? (closures as ClosureLike[]) : [];
  let single = false;
  let period = false;
  let reason: string | null = null;
  for (const c of list) {
    const from = typeof c?.from === 'string' ? c.from : '';
    const to = typeof c?.to === 'string' ? c.to : '';
    if (!from || !to || from > today || to < today) continue;
    if (from === today && to === today) single = true; else period = true;
    if (!reason && typeof c.reason === 'string' && c.reason.trim()) reason = c.reason.trim();
  }
  return { closed: single || period, single, period, reason };
}

/** Een "tot"-moment (sold_out_until, daily_special_until, paused_until) dat nog niet voorbij is. */
export const activeUntil = (iso: string | null | undefined, nowMs: number) => !!iso && new Date(iso).getTime() > nowMs;

/** Zones krijgen pas een tegel als er meer dan één actieve ruimte is (één ruimte dicht = de zaak dicht). */
export function zoneTiles<T extends { is_active: boolean }>(areas: T[] | null | undefined): T[] {
  const active = (areas ?? []).filter((a) => a.is_active);
  return active.length > 1 ? active : [];
}

/**
 * Pauzeren heeft enkel zin als er online besteld kan worden (afhalen/leveren via de webshop): de pauze geldt
 * niet voor bestellen aan tafel (PAUSE-1, storefront-api). Een lopende pauze blijft altijd te hervatten.
 */
export const pauseTileVisible = (s: { onlineOrdering: boolean; paused: boolean }) => s.onlineOrdering || s.paused;

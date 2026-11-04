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

/** Minimale vorm van de supabase-querybuilder die fetchActiveDailySpecials gebruikt (testbaar zonder client). */
interface SpecialsQuery extends PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> {
  eq(col: string, v: unknown): SpecialsQuery;
  gt(col: string, v: unknown): SpecialsQuery;
  order(col: string, opts?: { ascending?: boolean }): SpecialsQuery;
  limit(n: number): SpecialsQuery;
}
export interface SpecialsClient { from(table: string): { select(cols: string): SpecialsQuery } }

/**
 * HORECA-NU-1b — de dagschotels die nu lopen (products.daily_special_until > nu), zoals useCatalog in de
 * kassa. De databank filtert al op de toekomst: zonder die filter vulden vervallen dagschotels van vorige
 * dagen de limiet en vielen actieve weg. De client-filter blijft als vangnet (klok, cache).
 * `null` = de kolom bestaat nog niet (vóór de migratie): geen tegel.
 */
export async function fetchActiveDailySpecials(client: SpecialsClient, tenantId: string, nowMs: number): Promise<{ id: string; until: string }[] | null> {
  const { data, error } = await client.from('products').select('id, daily_special_until')
    .eq('tenant_id', tenantId)
    .gt('daily_special_until', new Date(nowMs).toISOString())
    .order('daily_special_until', { ascending: true })
    .limit(50);
  if (error?.code === '42703' || error?.code === 'PGRST204') return null;
  if (error) throw error;
  return ((data ?? []) as { id: string; daily_special_until: string | null }[])
    .filter((r) => activeUntil(r.daily_special_until, nowMs))
    .map((r) => ({ id: r.id, until: r.daily_special_until as string }));
}

/**
 * HORECA-NU-1b — staat dit product op het QR-menu of is het aan tafel te bestellen? Zelfde regel als
 * storefront-api `channelAllows(p, 'menu')` (menu óf table; geen lijst = alle kanalen, oud gedrag).
 */
export const onMenuChannel = (channels: readonly string[] | null | undefined) =>
  !Array.isArray(channels) || channels.includes('menu') || channels.includes('table');

/**
 * HORECA-NU-1b — mag dit product dagschotel worden? Actief, niet verborgen op de site en op het menu of aan
 * tafel. Een dagschotel die de gast nergens ziet, is een dode keuze.
 */
export const specialEligible = (p: { is_active: boolean | null; hide_from_storefront?: boolean | null; channels?: readonly string[] | null }) =>
  p.is_active === true && p.hide_from_storefront !== true && onMenuChannel(p.channels);

/**
 * HORECA-NU-1b — kanalen na "nieuw gerecht als dagschotel": menu en table erbij als ze ontbreken (in de vaste
 * volgorde `order`, de CHANNELS van ProductChannelsCard). `null` = niets te doen.
 */
export function withMenuChannels(channels: readonly string[] | null | undefined, order: readonly string[]): string[] | null {
  if (!Array.isArray(channels)) return null;
  if (channels.includes('menu') && channels.includes('table')) return null;
  const next = new Set([...channels, 'menu', 'table']);
  return order.filter((c) => next.has(c));
}

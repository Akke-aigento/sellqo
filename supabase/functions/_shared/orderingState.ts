// HORECA-STAAT-1 — één bron van waarheid voor "kan hier nu besteld worden?", per context:
//   - online: afhalen, leveren of verzenden via de website;
//   - table:  bestellen via de QR-code aan tafel.
// Pure functies zonder databank (storefront-api leest de rijen en geeft ze mee). Dezelfde uitkomst gaat
// additief naar get_config (`ordering_state`) en resolve_table, en elk serverpad dat een bestelling maakt
// dwingt ze af. Zo zeggen de site, het menu, het QR-menu en de server altijd hetzelfde.
//
// Regels (beslist door Akke, 04-11-2026):
//   - Vandaag dicht (business_hours.closures dekt vandaag): online én aan tafel dicht, los van
//     qr_block_outside_hours. Een blok van gisteren dat na middernacht doorloopt, telt nog (UREN-1c).
//   - Buiten de openingsuren: enkel met weekuren en met de bestaande schakelaars (qr_/online_block_outside_hours).
//   - Keuken gepauzeerd (paused_until): online dicht tot `until`; aan tafel enkel de keukengerechten
//     (scope 'kitchen', als de zaak posten heeft), anders alles (scope 'all').
//   - Online bestellen uit, website niet live of geen bruikbare afhaal-/lever-/verzendmethode: online dicht.
//   - QR uit of enkel bekijken: tafel dicht. Zone dicht: tafel dicht voor die zone.
import { addDaysYmd, closureDates, hoursTimezone, localYmd, parseClosures, parseWeek, safeTz, weekHasRanges, type BusinessHoursRow, type Closure, type Week } from './businessHours.ts';
import { closedMessage, localDay, openState, zonedToUtc } from './fulfillmentSlots.ts';

export type OrderingReason =
  | 'shop_offline' | 'ordering_off' | 'closed_today' | 'outside_hours' | 'paused'
  | 'qr_off' | 'qr_view' | 'zone_closed' | 'no_methods' | null;

export interface ContextState {
  open: boolean;
  reason: OrderingReason;
  /** Korte uitleg voor de gast (Nederlands, zoals de andere API-meldingen). Leeg als open zonder bijzonderheid. */
  message: string;
  /** Tot wanneer deze reden geldt (pauze, sluitingsdag, buiten de uren). Daarna mag een site opnieuw "open" tonen. */
  until?: string;
  /** Wanneer er weer besteld kan worden, als dat bekend is. */
  reopens_at?: string;
  /** Enkel bij reason 'paused' aan tafel: 'kitchen' = enkel keukengerechten liggen stil, 'all' = alles. */
  scope?: 'all' | 'kitchen';
}

export interface ClosedTodayInfo { reason: string | null; until: string; reopens_at: string | null }

export interface OrderingState {
  online: ContextState;
  table: ContextState;
  /** Vandaag uitzonderlijk dicht (los van de context), anders null. Voor de statusbalk en de voettekst. */
  closed_today: ClosedTodayInfo | null;
}

export type ServiceKind = 'pickup' | 'local_delivery';

export interface OrderingInput {
  nowMs: number;
  /** tenant_theme_settings.shop_live / shop_ordering. Ontbreekt (null/undefined) = geen beperking. */
  shopLive?: boolean | null;
  shopOrdering?: boolean | null;
  /** fulfillment_settings.qr_mode; ontbreekt = 'view' (zoals resolve_domain). */
  qrMode?: string | null;
  businessHours?: BusinessHoursRow | null;
  /** fulfillment_settings.timezone, als terugval na business_hours.timezone. */
  fulfillmentTz?: string | null;
  pausedUntil?: string | null;
  qrBlockOutsideHours?: boolean | null;
  onlineBlockOutsideHours?: boolean | null;
  slotsEnabled?: boolean | null;
  /** Soorten van de actieve verzendmethodes (shipping_methods.fulfillment_type). null = onbekend (geen regel). */
  methods?: string[] | null;
  /** De uren die echt gelden per soort (withBusinessHours). */
  serviceHours?: Partial<Record<ServiceKind, Week>> | null;
  /** De zone van de tafel (enkel in tafelcontext). */
  zone?: { name: string; is_open: boolean } | null;
  /** Heeft de zaak actieve bereidingsposten? Dan legt een pauze aan tafel enkel de keukengerechten stil. */
  kitchenSplit?: boolean | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DAY_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

/** "21:53" in de tijdzone van de zaak. */
export function hhmm(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: safeTz(tz), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
}

/** Aantal kalenderdagen tussen de lokale dag van `nowMs` en die van `ms`. */
function dayDiff(ms: number, nowMs: number, tz: string): number {
  const a = localDay(ms, tz); const b = localDay(nowMs, tz);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
}

/** Lokale datum van vandaag in een sluiting? Geeft die sluiting terug. */
function closureCovering(closures: Closure[], ymd: string): Closure | null {
  return closures.find((c) => ymd >= c.from && ymd <= c.to) || null;
}

/**
 * Vandaag uitzonderlijk dicht? Met weekuren telt een blok van gisteren dat na middernacht doorloopt nog
 * (een blok hoort bij zijn startdag, UREN-1c). `until` = lokale middernacht na de laatste aaneengesloten
 * sluitingsdag; `reopens_at` = eerste opening daarna volgens de weekuren, zonder weekuren gelijk aan `until`.
 */
export function closedTodayInfo(bh: BusinessHoursRow | null | undefined, fulfillmentTz: string | null | undefined, nowMs: number): ClosedTodayInfo | null {
  if (!bh) return null;
  const tz = hoursTimezone(bh.timezone, fulfillmentTz);
  const closures = parseClosures(bh.closures);
  if (!closures.length) return null;
  const today = localYmd(nowMs, tz);
  const c = closureCovering(closures, today);
  if (!c) return null;
  const week = parseWeek(bh.week);
  const closed = closureDates(closures, addDaysYmd(today, -1), 40);
  if (weekHasRanges(week) && openState(week, closed, tz, nowMs)?.open) return null;
  let next = addDaysYmd(today, 1);
  for (let i = 0; i < 400 && closureCovering(closures, next); i++) next = addDaysYmd(next, 1);
  const [y, m, d] = next.split('-').map(Number);
  const untilMs = zonedToUtc(y, m, d, 0, 0, tz);
  let reopens: string | null = new Date(untilMs).toISOString();
  if (weekHasRanges(week)) reopens = openState(week, closed, tz, untilMs)?.opens_at ?? null;
  return { reason: c.reason ?? null, until: new Date(untilMs).toISOString(), reopens_at: reopens };
}

/** "Morgen weer open" / "Weer open om 17:30" / "Weer open donderdag 11:30" / "" (onbekend). */
export function reopensLabel(reopensAt: string | null | undefined, tz: string, nowMs: number, midnight = false): string {
  if (!reopensAt) return '';
  const ms = new Date(reopensAt).getTime();
  if (!Number.isFinite(ms)) return '';
  const diff = dayDiff(ms, nowMs, tz);
  const t = hhmm(ms, tz);
  if (midnight) {
    if (diff === 1) return 'Morgen weer open';
    const ld = localDay(ms, tz);
    return diff < 7 ? `Weer open op ${DAY_NL[ld.weekday]}` : `Weer open op ${ld.d}/${ld.m}`;
  }
  if (diff === 0) return `Weer open om ${t}`;
  if (diff === 1) return `Morgen weer open om ${t}`;
  return `Weer open ${DAY_NL[localDay(ms, tz).weekday]} om ${t}`;
}

export function closedTodayMessage(info: ClosedTodayInfo, tz: string, nowMs: number, weekKnown: boolean): string {
  const head = info.reason ? `Vandaag gesloten · ${info.reason}` : 'Vandaag gesloten';
  const tail = reopensLabel(info.reopens_at, tz, nowMs, !weekKnown);
  return tail ? `${head} · ${tail}` : head;
}

const OPEN: ContextState = { open: true, reason: null, message: '' };

/** De stand per context. Puur: dezelfde invoer geeft altijd dezelfde uitkomst. */
export function computeOrderingState(input: OrderingInput): OrderingState {
  const now = input.nowMs;
  const bh = input.businessHours ?? null;
  const tz = bh ? hoursTimezone(bh.timezone, input.fulfillmentTz) : safeTz(input.fulfillmentTz);
  const week = parseWeek(bh?.week);
  const weekKnown = weekHasRanges(week);
  const closures = parseClosures(bh?.closures);
  const closedDates = closureDates(closures, addDaysYmd(localYmd(now, tz), -1), 16);
  const today = closedTodayInfo(bh, input.fulfillmentTz, now);
  const pausedMs = input.pausedUntil ? new Date(input.pausedUntil).getTime() : NaN;
  const paused = Number.isFinite(pausedMs) && pausedMs > now ? new Date(pausedMs).toISOString() : null;

  const closedTodayState = (): ContextState => ({
    open: false, reason: 'closed_today', message: closedTodayMessage(today!, tz, now, weekKnown),
    until: today!.until, ...(today!.reopens_at ? { reopens_at: today!.reopens_at } : {}),
  });

  // ---------- online ----------
  let online: ContextState = OPEN;
  const methods = input.methods ?? null;
  const usable = (t: string) => t !== 'pickup' && t !== 'local_delivery'
    || !input.slotsEnabled || weekHasRanges(input.serviceHours?.[t as ServiceKind]);
  if (input.shopLive === false) online = { open: false, reason: 'shop_offline', message: 'Deze website staat nog niet online.' };
  else if (input.shopOrdering === false) online = { open: false, reason: 'ordering_off', message: 'Online bestellen kan hier niet.' };
  else if (today) online = closedTodayState();
  else if (paused) online = { open: false, reason: 'paused', until: paused, reopens_at: paused, message: `De keuken neemt even geen bestellingen aan. Weer open om ${hhmm(pausedMs, tz)}.` };
  else if (methods && !methods.some(usable)) online = { open: false, reason: 'no_methods', message: 'Online bestellen kan nu niet: er is geen afhaal-, lever- of verzendmogelijkheid.' };
  else if (input.onlineBlockOutsideHours && !input.slotsEnabled && methods && methods.length && !methods.includes('shipping')) {
    // Enkel "zo snel mogelijk" (zonder tijdsloten): dicht als elke soort volgens haar uren dicht is.
    const states = methods.filter((t): t is ServiceKind => t === 'pickup' || t === 'local_delivery')
      .map((t) => openState(input.serviceHours?.[t], closedDates, tz, now));
    if (states.length && states.every((s) => s && !s.open)) {
      const next = states.map((s) => s!.opens_at).filter((x): x is string => !!x).sort()[0] ?? null;
      online = { open: false, reason: 'outside_hours', message: closedMessage(next, tz, now), ...(next ? { until: next, reopens_at: next } : {}) };
    }
  }

  // ---------- aan tafel ----------
  let table: ContextState = OPEN;
  const qr = input.qrMode || 'view';
  if (qr === 'off') table = { open: false, reason: 'qr_off', message: 'Bestellen via de QR-code staat uit in deze zaak.' };
  else if (qr !== 'order') table = { open: false, reason: 'qr_view', message: 'Deze kaart is om te bekijken. Bestellen doe je bij de bediening of aan de toog.' };
  else if (today) table = closedTodayState();
  else if (input.zone && input.zone.is_open === false) table = { open: false, reason: 'zone_closed', message: `${input.zone.name} is momenteel gesloten. Bestellen of de bediening roepen kan hier nu niet.` };
  else if (input.qrBlockOutsideHours && weekKnown) {
    const st = openState(week, closedDates, tz, now);
    if (st && !st.open) table = { open: false, reason: 'outside_hours', message: closedMessage(st.opens_at, tz, now), ...(st.opens_at ? { until: st.opens_at, reopens_at: st.opens_at } : {}) };
  }
  if (table.open && paused) {
    const t = hhmm(pausedMs, tz);
    table = input.kitchenSplit
      ? { open: true, reason: 'paused', scope: 'kitchen', until: paused, reopens_at: paused, message: `Keuken even gesloten tot ${t} · dranken kan je nog bestellen` }
      : { open: false, reason: 'paused', scope: 'all', until: paused, reopens_at: paused, message: `De keuken neemt even geen bestellingen aan. Weer open om ${t}.` };
  }

  return { online, table, closed_today: today };
}

// ---------- keuken of bar: via de bereidingsposten ----------
export interface StationRow { id: string; kind?: string | null; is_active?: boolean | null; is_default?: boolean | null }
export interface RouteRow { station_id: string; category_id?: string | null; product_id?: string | null }

/**
 * Naar welke post gaat dit product? Zelfde volgorde als horeca_apply_one (add_line): eerst de route op het
 * product, dan op de categorie, dan de standaardpost; enkel actieve posten.
 */
export function stationFor(p: { id: string; category_id?: string | null }, stations: StationRow[], routes: RouteRow[]): StationRow | null {
  const active = new Map(stations.filter((s) => s.is_active !== false).map((s) => [String(s.id), s]));
  const viaProduct = routes.find((r) => r.product_id && String(r.product_id) === String(p.id) && active.has(String(r.station_id)));
  if (viaProduct) return active.get(String(viaProduct.station_id))!;
  if (p.category_id) {
    const viaCat = routes.find((r) => r.category_id && String(r.category_id) === String(p.category_id) && active.has(String(r.station_id)));
    if (viaCat) return active.get(String(viaCat.station_id))!;
  }
  return [...active.values()].find((s) => s.is_default) ?? null;
}

/**
 * Ligt dit product stil tijdens een keukenpauze? Ja als het naar een post van soort 'kitchen' gaat, of als
 * niet te bepalen is waar het heen gaat (geen post: voorzichtig, liever even niet dan een vergeten bon).
 * Zonder actieve posten is er geen onderscheid: alles ligt stil.
 */
export function pausedAtKitchen(p: { id: string; category_id?: string | null }, stations: StationRow[], routes: RouteRow[]): boolean {
  if (!stations.some((s) => s.is_active !== false)) return true;
  const st = stationFor(p, stations, routes);
  return !st || st.kind === 'kitchen';
}

/** Heeft de zaak een bruikbaar onderscheid keuken/bar? (minstens één actieve post) */
export const hasKitchenSplit = (stations: StationRow[]) => stations.some((s) => s.is_active !== false);

/** "Keuken even gesloten tot 21:53" — melding bij een keukengerecht aan tafel tijdens de pauze. */
export function kitchenPausedMessage(name: string | null, untilIso: string, tz: string): string {
  const t = hhmm(new Date(untilIso).getTime(), tz);
  return name ? `${name}: keuken even gesloten tot ${t}` : `Keuken even gesloten tot ${t}`;
}

/** YYYY-MM-DD lokaal, voor tests en logs. */
export const ymdOf = (ms: number, tz: string) => { const d = localDay(ms, tz); return `${d.y}-${pad(d.m)}-${pad(d.d)}`; };

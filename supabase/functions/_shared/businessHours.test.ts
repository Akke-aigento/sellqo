// UREN-1 — unit tests voor de openingsuren en hun effect op afhaal- en leversloten (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/businessHours.test.ts
import { addDaysYmd, closureDates, hoursTimezone, localYmd, parseClosures, parseWeek, publicBusinessHours, resolveHoursMode, safeTz } from './businessHours.ts';
import { closedMessage, computeSlots, openState, orderingBlocked, withBusinessHours, type FulfillmentSettings } from './fulfillmentSlots.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

// Dinsdag 13 oktober 2026, 10:00 Brussel (CEST) = 08:00 UTC.
const TUE_10 = Date.UTC(2026, 9, 13, 8, 0);
type FS = FulfillmentSettings & { pickup_hours_mode?: string | null; delivery_hours_mode?: string | null };
const fs = (over: Partial<FS> = {}): FS => ({
  slots_enabled: true, slot_minutes: 30, prep_minutes: 0, days_ahead: 0, max_orders_per_slot: null, timezone: 'Europe/Brussels',
  hours: {}, ...over,
});
const BH = { week: { '2': [['11:30', '12:30'], ['17:30', '18:30']] }, closures: [], timezone: 'Europe/Brussels' };

Deno.test('parseWeek: enkel geldige dagen en blokken', () => {
  eq(parseWeek({ '1': [['11:30', '14:00'], ['x', '1'], ['10:00', '10:00']], '9': [['10:00', '11:00']], '2': 'nee' }), { '1': [['11:30', '14:00']] });
  eq(parseWeek(null), {});
  eq(parseWeek([['10:00', '11:00']]), {});
});

Deno.test('parseClosures: geldig, gesorteerd, reden ingekort', () => {
  eq(parseClosures([{ from: '2026-12-24', to: '2026-12-26', reason: ' Kerst ' }, { from: '2026-11-11', to: '2026-11-11' }, { from: '2026-12-02', to: '2026-12-01' }, 'x']),
    [{ from: '2026-11-11', to: '2026-11-11', reason: null }, { from: '2026-12-24', to: '2026-12-26', reason: 'Kerst' }]);
});

Deno.test('resolveHoursMode: keuze wint, anders afgeleid uit de bestaande uren', () => {
  eq(resolveHoursMode('own', {}), 'own');
  eq(resolveHoursMode('business', { '1': [['10:00', '11:00']] }), 'business');
  eq(resolveHoursMode(null, { '1': [['10:00', '11:00']] }), 'own', 'bestaande zaak met eigen uren houdt ze');
  eq(resolveHoursMode(null, {}), 'business', 'nieuwe zaak: zelfde als openingsuren');
  eq(resolveHoursMode(undefined, undefined), 'business');
});


Deno.test('closureDates: periode wordt per dag, enkel binnen het venster', () => {
  eq(closureDates([{ from: '2026-10-12', to: '2026-10-14', reason: null }, { from: '2026-10-20', to: '2026-10-20' }], '2026-10-13', 3), ['2026-10-13', '2026-10-14']);
});

Deno.test('publicBusinessHours: null zonder iets ingevuld, voorbije sluitingen weg', () => {
  eq(publicBusinessHours(null, TUE_10), null);
  eq(publicBusinessHours({ week: {}, closures: [] }, TUE_10), null);
  eq(publicBusinessHours({ week: {}, closures: [{ from: '2026-10-01', to: '2026-10-12' }] }, TUE_10), null, 'enkel voorbije sluiting = niets');
  eq(publicBusinessHours({ week: { '2': [['11:30', '14:00']] }, closures: [{ from: '2026-10-01', to: '2026-10-12' }, { from: '2026-10-13', to: '2026-10-13', reason: 'Verlof' }] }, TUE_10),
    { timezone: 'Europe/Brussels', week: { '2': [['11:30', '14:00']] }, closures: [{ from: '2026-10-13', to: '2026-10-13', reason: 'Verlof' }], table_ordering_when_closed: 'allow' });
  eq((publicBusinessHours({ week: { '2': [['11:30', '14:00']] } }, TUE_10, true) as { table_ordering_when_closed: string }).table_ordering_when_closed, 'block');
});

Deno.test('afhalen "zelfde als openingsuren": sloten uit business_hours', () => {
  const s = withBusinessHours(fs({ pickup_hours_mode: 'business' }), BH, TUE_10);
  eq(computeSlots(s, 'pickup', TUE_10).map((x) => x.label), ['11:30', '12:00', '17:30', '18:00']);
});

Deno.test('bestaande zaak met eigen uren en geen keuze: ongewijzigd', () => {
  const own: FulfillmentSettings['hours'] = { pickup: { '2': [['17:00', '18:00']] } };
  const s = withBusinessHours(fs({ hours: own }), BH, TUE_10);
  eq(computeSlots(s, 'pickup', TUE_10).map((x) => x.label), ['17:00', '17:30']);
});

Deno.test('leveren zonder eigen uren en zonder keuze volgt de openingsuren, afhalen eigen uren', () => {
  const s = withBusinessHours(fs({ hours: { pickup: { '2': [['17:00', '18:00']] } } }), BH, TUE_10);
  eq(computeSlots(s, 'local_delivery', TUE_10).map((x) => x.label), ['11:30', '12:00', '17:30', '18:00']);
  eq(computeSlots(s, 'pickup', TUE_10).map((x) => x.label), ['17:00', '17:30']);
});

Deno.test('expliciet "eigen uren" wint, ook als ze leeg zijn', () => {
  const s = withBusinessHours(fs({ pickup_hours_mode: 'own' }), BH, TUE_10);
  eq(computeSlots(s, 'pickup', TUE_10).length, 0);
});

Deno.test('sluitingsdag (periode) uit de openingsuren: geen sloten en "zo snel mogelijk" kan niet, ook bij eigen uren', () => {
  const bh = { ...BH, closures: [{ from: '2026-10-12', to: '2026-10-14', reason: 'Verlof' }] };
  const s = withBusinessHours(fs({ hours: { pickup: { '2': [['17:00', '18:00']] } } }), bh, TUE_10);
  eq(computeSlots(s, 'pickup', TUE_10).length, 0);
  eq(orderingBlocked(s, TUE_10), { reason: 'closed_today' });
  eq(orderingBlocked(withBusinessHours(fs(), BH, TUE_10), TUE_10), null, 'geen sluiting = niet geblokkeerd');
});

Deno.test('oude closed_dates (PAUSE-1) worden niet meer gelezen: de bron is business_hours', () => {
  const s = withBusinessHours(fs({ pickup_hours_mode: 'business', closed_dates: ['2026-10-13'] }), BH, TUE_10);
  eq(computeSlots(s, 'pickup', TUE_10).length, 4);
});

Deno.test('openingsuren over middernacht: sloten na 00:00 op de volgende dag', () => {
  // Maandag 12 oktober 2026, 23:00 Brussel = 21:00 UTC; maandag open 22:00–01:00.
  const now = Date.UTC(2026, 9, 12, 21, 0);
  const bh = { week: { '1': [['22:00', '01:00']] }, closures: [] };
  const s = withBusinessHours(fs({ pickup_hours_mode: 'business', days_ahead: 1 }), bh, now);
  eq(computeSlots(s, 'pickup', now).map((x) => `${x.date} ${x.label}`), ['2026-10-12 23:00', '2026-10-12 23:30', '2026-10-13 00:00', '2026-10-13 00:30']);
});

Deno.test('zonder openingsuren (geen rij): "zelfde als" geeft geen sloten, eigen uren blijven', () => {
  eq(computeSlots(withBusinessHours(fs(), null, TUE_10), 'pickup', TUE_10).length, 0);
  eq(computeSlots(withBusinessHours(fs({ hours: { pickup: { '2': [['17:00', '17:30']] } } }), null, TUE_10), 'pickup', TUE_10).length, 1);
});

// --- UREN-1b: open of dicht, en wanneer weer open ---------------------------------------------------
const WEEK = parseWeek({ '2': [['11:30', '14:00'], ['17:30', '22:00']], '3': [['11:30', '14:00']], '6': [['20:00', '02:00']] });
const T = (iso: string) => Date.parse(iso);
Deno.test('openState: open binnen een blok, anders het volgende blok', () => {
  eq(openState(WEEK, [], 'Europe/Brussels', T('2026-10-13T10:00:00Z')), { open: true, opens_at: null }, 'di 12:00');
  eq(openState(WEEK, [], 'Europe/Brussels', T('2026-10-13T13:00:00Z')), { open: false, opens_at: '2026-10-13T15:30:00.000Z' }, 'di 15:00 → 17:30');
  eq(openState(WEEK, [], 'Europe/Brussels', T('2026-10-13T20:30:00Z')), { open: false, opens_at: '2026-10-14T09:30:00.000Z' }, 'di 22:30 → wo 11:30');
  eq(openState(WEEK, [], 'Europe/Brussels', T('2026-10-17T23:00:00Z'))?.open, true, 'za→zo 01:00 (staart)');
});
Deno.test('openState: sluitingsdag en leeg schema', () => {
  eq(openState(WEEK, ['2026-10-14'], 'Europe/Brussels', T('2026-10-13T20:30:00Z')), { open: false, opens_at: '2026-10-17T18:00:00.000Z' }, 'wo dicht → za 20:00');
  eq(openState({}, [], 'Europe/Brussels', TUE_10), null, 'geen uren = geen regel');
});
Deno.test('closedMessage: vandaag, morgen, weekdag', () => {
  const now = T('2026-10-13T13:00:00Z');
  eq(closedMessage('2026-10-13T15:30:00.000Z', 'Europe/Brussels', now), 'We zijn nu gesloten. Bestellen kan vanaf 17:30.');
  eq(closedMessage('2026-10-14T09:30:00.000Z', 'Europe/Brussels', now), 'We zijn nu gesloten. Bestellen kan vanaf morgen 11:30.');
  eq(closedMessage('2026-10-17T18:00:00.000Z', 'Europe/Brussels', now), 'We zijn nu gesloten. Bestellen kan vanaf zaterdag 20:00.');
  eq(closedMessage(null, 'Europe/Brussels', now), 'We zijn nu gesloten.');
});

// --- UREN-1c: sluitingsdag rond middernacht — een blok hoort bij zijn startdag -------------------------
// Zaterdag 17 oktober 2026 (CEST, UTC+2). Zondag 18 oktober 00:30 Brussel = za 17 okt 22:30 UTC.
const SUN_0030 = T('2026-10-17T22:30:00Z');
const SAT_0030 = T('2026-10-16T22:30:00Z'); // zaterdag 17 oktober 00:30 Brussel
const sat = { week: { '6': [['20:00', '02:00']] }, timezone: 'Europe/Brussels' };
const fri = { week: { '5': [['20:00', '02:00']] }, timezone: 'Europe/Brussels' };
const slotsAt = (bh: { week: unknown; closures: unknown; timezone?: string }, now: number) =>
  computeSlots(withBusinessHours(fs({ pickup_hours_mode: 'business', days_ahead: 1 }), bh, now), 'pickup', now).map((x) => `${x.date} ${x.label}`);

Deno.test('UREN-1c: za 20:00–02:00, zondag gesloten, zo 00:30 → open (staart blijft)', () => {
  const bh = { ...sat, closures: [{ from: '2026-10-18', to: '2026-10-18' }] };
  const s = withBusinessHours(fs({ pickup_hours_mode: 'business', slots_enabled: false }), bh, SUN_0030);
  eq(openState(s.hours.pickup, s.closed_dates, s.timezone, SUN_0030)?.open, true, 'openState');
  eq(orderingBlocked(s, SUN_0030, s.hours.pickup), null, 'zo snel mogelijk: niet geblokkeerd tijdens de staart');
  eq(orderingBlocked(s, SUN_0030), { reason: 'closed_today' }, 'zonder uren: PAUSE-1-gedrag (sluitingsdag vandaag)');
  eq(slotsAt(bh, SUN_0030), ['2026-10-18 00:30', '2026-10-18 01:00', '2026-10-18 01:30'], 'sloten na middernacht blijven');
});

Deno.test('UREN-1c: vr 20:00–02:00, zaterdag gesloten, za 00:30 → open', () => {
  const bh = { ...fri, closures: [{ from: '2026-10-17', to: '2026-10-17' }] };
  const s = withBusinessHours(fs({ pickup_hours_mode: 'business' }), bh, SAT_0030);
  eq(openState(s.hours.pickup, s.closed_dates, s.timezone, SAT_0030)?.open, true);
  eq(slotsAt(bh, SAT_0030), ['2026-10-17 00:30', '2026-10-17 01:00', '2026-10-17 01:30']);
});

Deno.test('UREN-1c: startdag gesloten → ook na middernacht dicht', () => {
  const bh = { ...sat, closures: [{ from: '2026-10-17', to: '2026-10-17' }] };
  const s = withBusinessHours(fs({ pickup_hours_mode: 'business' }), bh, SUN_0030);
  eq(openState(s.hours.pickup, s.closed_dates, s.timezone, SUN_0030)?.open, false);
  eq(slotsAt(bh, SUN_0030), [], 'geen sloten na middernacht');
  // Zaterdagavond zelf ook geen sloten (vrijdag 16 okt 21:00 Brussel kijkt een dag vooruit).
  eq(slotsAt(bh, T('2026-10-16T19:00:00Z')), []);
});

Deno.test('UREN-1c: QR aan tafel (tableClosedError-pad) — ongesplitst schema + sluitingen vanaf gisteren', () => {
  const closures = parseClosures([{ from: '2026-10-18', to: '2026-10-18' }]);
  const closed = closureDates(closures, addDaysYmd(localYmd(SUN_0030, 'Europe/Brussels'), -1), 10);
  eq(openState(parseWeek(sat.week), closed, 'Europe/Brussels', SUN_0030)?.open, true, 'zo dicht, staart van za: open');
  const closedSat = closureDates(parseClosures([{ from: '2026-10-17', to: '2026-10-17' }]), addDaysYmd(localYmd(SUN_0030, 'Europe/Brussels'), -1), 10);
  eq(openState(parseWeek(sat.week), closedSat, 'Europe/Brussels', SUN_0030)?.open, false, 'za dicht: ook de staart dicht');
});

Deno.test('UREN-1c: tijdzone — business_hours eerst, dan fulfillment_settings, onbekend → Brussel', () => {
  eq(safeTz('Europe/Leuven'), 'Europe/Brussels');
  eq(safeTz(''), 'Europe/Brussels');
  eq(safeTz('America/New_York'), 'America/New_York');
  eq(hoursTimezone('America/New_York', 'Europe/London'), 'America/New_York');
  eq(hoursTimezone(null, 'Europe/London'), 'Europe/London');
  eq(hoursTimezone('', null), 'Europe/Brussels');
  eq(hoursTimezone('Europe/Leuven', 'Europe/London'), 'Europe/Brussels', 'foute business_hours-zone: niet stil een andere bron');
  eq(withBusinessHours(fs({ timezone: 'Europe/London' }), { week: {}, closures: [], timezone: 'America/New_York' }, TUE_10).timezone, 'America/New_York');
  eq(withBusinessHours(fs({ timezone: 'Europe/London' }), null, TUE_10).timezone, 'Europe/London', 'geen rij: fulfillment_settings');
  eq(localYmd(TUE_10, 'Europe/Leuven'), '2026-10-13', 'localYmd valt terug');
  eq(openState(WEEK, [], 'Europe/Leuven', T('2026-10-13T10:00:00Z')), { open: true, opens_at: null }, 'openState valt terug');
  eq(closedMessage('2026-10-13T15:30:00.000Z', 'Nergens/Niets', T('2026-10-13T13:00:00Z')), 'We zijn nu gesloten. Bestellen kan vanaf 17:30.');
  eq(computeSlots(fs({ timezone: 'Nergens/Niets', hours: { pickup: { '2': [['11:30', '12:00']] } } }), 'pickup', TUE_10).map((x) => x.label), ['11:30']);
  const pub = publicBusinessHours({ week: { '2': [['11:30', '14:00']] }, closures: [], timezone: 'Europe/Leuven' }, TUE_10, false, 'Europe/London');
  eq(pub?.timezone, 'Europe/Brussels', 'get_config: nooit een onbekende zone naar de site');
  eq(publicBusinessHours({ week: { '2': [['11:30', '14:00']] }, closures: [] }, TUE_10, false, 'Europe/London')?.timezone, 'Europe/London');
});

Deno.test('UREN-1c: eigen uren (FOOD-1) kennen geen blok over middernacht', () => {
  const s = withBusinessHours(fs({ hours: { pickup: { '2': [['22:00', '01:00']] } } }), BH, TUE_10);
  eq(computeSlots(s, 'pickup', TUE_10), []);
});

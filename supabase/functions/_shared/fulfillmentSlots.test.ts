// FOOD-1 — unit tests voor tijdsloten en leverzones (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/fulfillmentSlots.test.ts
import { computeSlots, postalCodeAllowed, zonedToUtc, type FulfillmentSettings } from './fulfillmentSlots.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

const base = (over: Partial<FulfillmentSettings> = {}): FulfillmentSettings => ({
  slots_enabled: true, slot_minutes: 15, prep_minutes: 0, days_ahead: 0, max_orders_per_slot: null,
  timezone: 'Europe/Brussels',
  hours: { pickup: { '2': [['17:00', '18:00']] }, local_delivery: { '2': [['18:00', '19:00']] } },
  ...over,
});
// Dinsdag 13 oktober 2026, 10:00 Brussel (CEST, UTC+2) = 08:00 UTC.
const TUE_10 = Date.UTC(2026, 9, 13, 8, 0);

Deno.test('zonedToUtc: zomer- en wintertijd', () => {
  eq(new Date(zonedToUtc(2026, 10, 13, 17, 0, 'Europe/Brussels')).toISOString(), '2026-10-13T15:00:00.000Z', 'CEST');
  eq(new Date(zonedToUtc(2026, 11, 13, 17, 0, 'Europe/Brussels')).toISOString(), '2026-11-13T16:00:00.000Z', 'CET');
});

Deno.test('sloten binnen de openingsuren, laatste slot eindigt op sluitingstijd', () => {
  const s = computeSlots(base(), 'pickup', TUE_10);
  eq(s.map((x) => x.label), ['17:00', '17:15', '17:30', '17:45']);
  eq(s[0].start, '2026-10-13T15:00:00.000Z');
  eq(s[0].date, '2026-10-13');
  eq(s.every((x) => x.available), true);
});

Deno.test('levering heeft eigen uren', () => {
  eq(computeSlots(base(), 'local_delivery', TUE_10).map((x) => x.label), ['18:00', '18:15', '18:30', '18:45']);
});

Deno.test('bereidingstijd schuift het eerste slot op', () => {
  // 16:50 lokaal + 30 min = 17:20 → eerste slot 17:30.
  const now = Date.UTC(2026, 9, 13, 14, 50);
  eq(computeSlots(base({ prep_minutes: 30 }), 'pickup', now).map((x) => x.label), ['17:30', '17:45']);
});

Deno.test('volle sloten zijn niet beschikbaar', () => {
  const s = computeSlots(base({ max_orders_per_slot: 2 }), 'pickup', TUE_10, { '2026-10-13T15:15:00.000Z': 2, '2026-10-13T15:30:00.000Z': 1 });
  eq(s.map((x) => x.available), [true, false, true, true]);
});

Deno.test('gesloten dag geeft geen sloten, days_ahead loopt verder', () => {
  const s = computeSlots(base({ days_ahead: 7 }), 'pickup', TUE_10);
  eq(s.length, 8, 'twee dinsdagen');
  eq(s[4].date, '2026-10-20');
});

Deno.test('zomertijdwissel slaat geen dag over', () => {
  // Zaterdag 24 okt 2026 23:30 lokaal (CEST) → zondag 25 okt is de wisseldag (25 uur).
  const now = Date.UTC(2026, 9, 24, 21, 30);
  const h = { pickup: { '0': [['17:00', '17:30']] as [string, string][], '1': [['17:00', '17:30']] as [string, string][] } };
  const s = computeSlots(base({ days_ahead: 2, hours: h }), 'pickup', now);
  eq(s.map((x) => `${x.date} ${x.label}`), ['2026-10-25 17:00', '2026-10-25 17:15', '2026-10-26 17:00', '2026-10-26 17:15']);
  eq(s[0].start, '2026-10-25T16:00:00.000Z', 'na de wissel is het UTC+1');
});

Deno.test('overlappende uren geven geen dubbele sloten', () => {
  const h = { pickup: { '2': [['17:00', '17:30'], ['17:15', '17:45']] as [string, string][] } };
  eq(computeSlots(base({ hours: h }), 'pickup', TUE_10).map((x) => x.label), ['17:00', '17:15', '17:30']);
});

Deno.test('ongeldige uren worden genegeerd', () => {
  const h = { pickup: { '2': [['18:00', '17:00'], ['x', '19:00']] as [string, string][] } };
  eq(computeSlots(base({ hours: h }), 'pickup', TUE_10), []);
});

Deno.test('postcodes: leeg = overal, prefix en sterretje', () => {
  eq(postalCodeAllowed('3000', []), true);
  eq(postalCodeAllowed('3000', null), true);
  eq(postalCodeAllowed('3000', ['3000']), true);
  eq(postalCodeAllowed('3010', ['30*']), true);
  eq(postalCodeAllowed('3010', ['3000', '3001']), false);
  eq(postalCodeAllowed('1012 AB', ['1012']), true);
  eq(postalCodeAllowed('', ['3000']), false);
  eq(postalCodeAllowed('2000', ['']), false);
});

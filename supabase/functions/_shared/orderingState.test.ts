// HORECA-STAAT-1 — unit tests voor computeOrderingState en de keuken/bar-regel (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/orderingState.test.ts
import { closedTodayInfo, computeOrderingState, hasKitchenSplit, hhmm, kitchenPausedMessage, pausedAtKitchen, reopensLabel, stationFor, type OrderingInput } from './orderingState.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}
const ok = (c: unknown, msg: string) => { if (!c) throw new Error(msg); };

// Woensdag 4 november 2026, 20:38 Brussel (CET) = 19:38 UTC.
const WED_2038 = Date.UTC(2026, 10, 4, 19, 38);
const TZ = 'Europe/Brussels';
const base = (over: Partial<OrderingInput> = {}): OrderingInput => ({
  nowMs: WED_2038, shopLive: true, shopOrdering: true, qrMode: 'order', businessHours: null, fulfillmentTz: TZ,
  pausedUntil: null, qrBlockOutsideHours: false, onlineBlockOutsideHours: false, slotsEnabled: false,
  methods: ['pickup'], serviceHours: {}, zone: null, kitchenSplit: true, ...over,
});
const allDays = (r: [string, string][]) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), r]));

Deno.test('normaal: alles open, geen melding', () => {
  const s = computeOrderingState(base());
  eq(s.online, { open: true, reason: null, message: '' });
  eq(s.table, { open: true, reason: null, message: '' });
  eq(s.closed_today, null);
});

Deno.test('Café De Wissel live (04-11): vandaag dicht zonder weekuren + pauze → online en tafel dicht, morgen weer open', () => {
  const s = computeOrderingState(base({
    businessHours: { week: {}, closures: [{ from: '2026-11-04', to: '2026-11-04', reason: 'Personeel ziek' }], timezone: TZ },
    pausedUntil: '2026-11-04T20:53:57.673Z', slotsEnabled: true,
  }));
  eq(s.online.reason, 'closed_today');
  eq(s.online.open, false);
  eq(s.online.message, 'Vandaag gesloten · Personeel ziek · Morgen weer open');
  eq(s.online.until, '2026-11-04T23:00:00.000Z', 'lokale middernacht');
  eq(s.table.reason, 'closed_today', 'een expliciete sluiting is ook aan tafel een sluiting');
  eq(s.table.open, false);
  eq(s.closed_today, { reason: 'Personeel ziek', until: '2026-11-04T23:00:00.000Z', reopens_at: '2026-11-04T23:00:00.000Z' });
});

Deno.test('vandaag dicht staat los van qr_block_outside_hours', () => {
  const bh = { week: {}, closures: [{ from: '2026-11-04', to: '2026-11-04' }], timezone: TZ };
  eq(computeOrderingState(base({ businessHours: bh, qrBlockOutsideHours: false })).table.reason, 'closed_today');
  eq(computeOrderingState(base({ businessHours: bh, qrBlockOutsideHours: true })).table.reason, 'closed_today');
  eq(computeOrderingState(base({ businessHours: bh })).online.message, 'Vandaag gesloten · Morgen weer open', 'zonder reden');
});

Deno.test('sluitingsperiode: until na de laatste dag, met weekuren de eerste opening daarna', () => {
  const bh = { week: allDays([['11:00', '22:00']]), closures: [{ from: '2026-11-03', to: '2026-11-06', reason: 'Verlof' }], timezone: TZ };
  const s = computeOrderingState(base({ businessHours: bh }));
  eq(s.closed_today?.until, '2026-11-06T23:00:00.000Z');
  eq(s.closed_today?.reopens_at, '2026-11-07T10:00:00.000Z', 'za 7 nov 11:00');
  eq(s.online.message, 'Vandaag gesloten · Verlof · Weer open zaterdag om 11:00');
});

Deno.test('vandaag dicht, maar het blok van gisteren loopt nog (na middernacht) → nog open', () => {
  // Dinsdag 20:00–02:00; woensdag dicht; woensdag 00:30 = nog het blok van dinsdag.
  const WED_0030 = Date.UTC(2026, 10, 3, 23, 30);
  const bh = { week: { '2': [['20:00', '02:00']] as [string, string][] }, closures: [{ from: '2026-11-04', to: '2026-11-04' }], timezone: TZ };
  eq(closedTodayInfo(bh, TZ, WED_0030), null);
  eq(computeOrderingState(base({ nowMs: WED_0030, businessHours: bh, qrBlockOutsideHours: true })).table.reason, null);
  // Om 02:30 is het blok voorbij: dicht.
  eq(computeOrderingState(base({ nowMs: WED_0030 + 2 * 3600_000, businessHours: bh })).table.reason, 'closed_today');
});

Deno.test('closure zonder weekuren, morgen niet: reopensLabel "Morgen weer open"; overmorgen: weekdag', () => {
  eq(reopensLabel('2026-11-04T23:00:00.000Z', TZ, WED_2038, true), 'Morgen weer open');
  eq(reopensLabel('2026-11-05T23:00:00.000Z', TZ, WED_2038, true), 'Weer open op vrijdag');
  eq(reopensLabel(null, TZ, WED_2038), '');
});

Deno.test('keuken gepauzeerd: online dicht tot until, aan tafel enkel de keuken (met posten)', () => {
  const s = computeOrderingState(base({ pausedUntil: '2026-11-04T20:53:00Z' }));
  eq(s.online, { open: false, reason: 'paused', until: '2026-11-04T20:53:00.000Z', reopens_at: '2026-11-04T20:53:00.000Z', message: 'De keuken neemt even geen bestellingen aan. Weer open om 21:53.' });
  eq(s.table, { open: true, reason: 'paused', scope: 'kitchen', until: '2026-11-04T20:53:00.000Z', reopens_at: '2026-11-04T20:53:00.000Z', message: 'Keuken even gesloten tot 21:53 · dranken kan je nog bestellen' });
});

Deno.test('keuken gepauzeerd zonder posten: aan tafel ligt alles stil', () => {
  const s = computeOrderingState(base({ pausedUntil: '2026-11-04T20:53:00Z', kitchenSplit: false }));
  eq(s.table.open, false);
  eq(s.table.scope, 'all');
});

Deno.test('verlopen pauze telt niet meer', () => {
  const s = computeOrderingState(base({ pausedUntil: '2026-11-04T19:00:00Z' }));
  eq(s.online.reason, null);
  eq(s.table.reason, null);
  eq(computeOrderingState(base({ pausedUntil: 'geen datum' })).online.reason, null, 'ongeldige waarde');
});

Deno.test('online bestellen uit / website niet live: online dicht, tafel blijft open', () => {
  const off = computeOrderingState(base({ shopOrdering: false }));
  eq(off.online.reason, 'ordering_off');
  eq(off.table.reason, null);
  eq(computeOrderingState(base({ shopLive: false })).online.reason, 'shop_offline');
  // Onbekend (null): geen regel, zoals een eigen frontend zonder rij.
  eq(computeOrderingState(base({ shopLive: null, shopOrdering: null })).online.reason, null);
});

Deno.test('volgorde: website offline gaat vóór vandaag dicht en pauze; closed_today blijft apart gemeld', () => {
  const s = computeOrderingState(base({ shopOrdering: false, pausedUntil: '2026-11-04T20:53:00Z', businessHours: { week: {}, closures: [{ from: '2026-11-04', to: '2026-11-04' }] } }));
  eq(s.online.reason, 'ordering_off');
  ok(s.closed_today, 'closed_today ook zonder online bestellen');
  eq(s.table.reason, 'closed_today', 'tafel: sluiting gaat vóór de pauze');
});

Deno.test('geen bruikbare methode: geen methodes, of enkel afhalen met tijdsloten maar zonder uren', () => {
  eq(computeOrderingState(base({ methods: [] })).online.reason, 'no_methods');
  eq(computeOrderingState(base({ methods: ['pickup'], slotsEnabled: true, serviceHours: { pickup: {} } })).online.reason, 'no_methods');
  eq(computeOrderingState(base({ methods: ['pickup'], slotsEnabled: true, serviceHours: { pickup: { '1': [['10:00', '11:00']] } } })).online.reason, null);
  eq(computeOrderingState(base({ methods: ['shipping'], slotsEnabled: true })).online.reason, null, 'verzenden heeft geen uren nodig');
  eq(computeOrderingState(base({ methods: null })).online.reason, null, 'onbekend: geen regel');
});

Deno.test('buiten de openingsuren: tafel enkel met qr_block en weekuren; online enkel zonder tijdsloten en met de schakelaar', () => {
  const week = { '1': [['10:00', '11:00']] as [string, string][] }; // maandag; nu woensdag avond → dicht
  const bh = { week, closures: [], timezone: TZ };
  eq(computeOrderingState(base({ businessHours: bh })).table.reason, null, 'standaard toegestaan');
  const t = computeOrderingState(base({ businessHours: bh, qrBlockOutsideHours: true })).table;
  eq(t.reason, 'outside_hours');
  eq(t.until, '2026-11-09T09:00:00.000Z');
  ok(/Bestellen kan vanaf maandag 10:00/.test(t.message), t.message);
  eq(computeOrderingState(base({ businessHours: { week: {}, closures: [] }, qrBlockOutsideHours: true })).table.reason, null, 'zonder weekuren geen regel');
  const o = computeOrderingState(base({ businessHours: bh, onlineBlockOutsideHours: true, serviceHours: { pickup: week } })).online;
  eq(o.reason, 'outside_hours');
  eq(computeOrderingState(base({ businessHours: bh, onlineBlockOutsideHours: true, slotsEnabled: true, serviceHours: { pickup: week } })).online.reason, null, 'met tijdsloten kiest de klant een later slot');
  eq(computeOrderingState(base({ businessHours: bh, onlineBlockOutsideHours: true, methods: ['pickup', 'shipping'], serviceHours: { pickup: week } })).online.reason, null, 'verzenden kan altijd');
});

Deno.test('zone dicht: tafel dicht met de zonenaam; open zone of geen zone: niets', () => {
  const s = computeOrderingState(base({ zone: { name: 'Terras', is_open: false } }));
  eq(s.table.reason, 'zone_closed');
  eq(s.table.message, 'Terras is momenteel gesloten. Bestellen of de bediening roepen kan hier nu niet.');
  eq(s.online.reason, null, 'online merkt niets van een dichte zone');
  eq(computeOrderingState(base({ zone: { name: 'Zaal', is_open: true } })).table.reason, null);
});

Deno.test('QR uit of enkel bekijken: tafel dicht; ontbrekende qr_mode = view', () => {
  eq(computeOrderingState(base({ qrMode: 'off' })).table.reason, 'qr_off');
  eq(computeOrderingState(base({ qrMode: 'view' })).table.reason, 'qr_view');
  eq(computeOrderingState(base({ qrMode: null })).table.reason, 'qr_view');
});

Deno.test('tijdzone: onbekende zone valt terug op Brussel; zomertijd juist', () => {
  const s = computeOrderingState(base({ businessHours: { week: {}, closures: [{ from: '2026-11-04', to: '2026-11-04' }], timezone: 'Europe/Leuven' }, fulfillmentTz: null }));
  eq(s.closed_today?.until, '2026-11-04T23:00:00.000Z');
  // Zomertijd: 31 maart 2026 (CEST, +2): middernacht = 22:00 UTC.
  const MAR = Date.UTC(2026, 2, 31, 10, 0);
  eq(closedTodayInfo({ week: {}, closures: [{ from: '2026-03-31', to: '2026-03-31' }], timezone: TZ }, null, MAR)?.until, '2026-03-31T22:00:00.000Z');
  // Over de omschakeling: zondag 29 maart 2026 dicht → maandag 00:00 CEST = 28 → 29 22:00 UTC.
  const SUN = Date.UTC(2026, 2, 29, 10, 0);
  eq(closedTodayInfo({ week: {}, closures: [{ from: '2026-03-29', to: '2026-03-29' }], timezone: TZ }, null, SUN)?.until, '2026-03-29T22:00:00.000Z');
  eq(hhmm(Date.UTC(2026, 6, 1, 19, 53), TZ), '21:53', 'zomer +2');
});

Deno.test('keuken of bar: route op product, dan categorie, dan standaardpost; enkel actieve posten', () => {
  const stations = [
    { id: 'bar', kind: 'bar', is_active: true, is_default: true },
    { id: 'keuken', kind: 'kitchen', is_active: true, is_default: false },
    { id: 'oud', kind: 'bar', is_active: false, is_default: false },
  ];
  const routes = [
    { station_id: 'keuken', category_id: 'cat-eten' },
    { station_id: 'bar', product_id: 'p-soep-to-go' },
    { station_id: 'oud', product_id: 'p-koffie' },
  ];
  eq(stationFor({ id: 'p-burger', category_id: 'cat-eten' }, stations, routes)?.id, 'keuken');
  eq(stationFor({ id: 'p-soep-to-go', category_id: 'cat-eten' }, stations, routes)?.id, 'bar', 'product wint van categorie');
  eq(stationFor({ id: 'p-koffie', category_id: null }, stations, routes)?.id, 'bar', 'inactieve post → standaard');
  eq(pausedAtKitchen({ id: 'p-burger', category_id: 'cat-eten' }, stations, routes), true);
  eq(pausedAtKitchen({ id: 'p-cola', category_id: 'cat-drank' }, stations, routes), false, 'drank naar de bar');
  // Geen standaardpost en geen route: onbekend = voorzichtig stil.
  eq(pausedAtKitchen({ id: 'x' }, [{ id: 'k', kind: 'kitchen', is_active: true, is_default: false }], []), true);
  // Geen posten: geen onderscheid.
  eq(hasKitchenSplit([]), false);
  eq(pausedAtKitchen({ id: 'p-cola' }, [], []), true);
  eq(kitchenPausedMessage('Croque', '2026-11-04T20:53:00Z', TZ), 'Croque: keuken even gesloten tot 21:53');
});

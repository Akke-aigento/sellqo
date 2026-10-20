// SIZECHART-1 — tests voor de standaard-maattabel en de factchecks.
// Run: deno test --no-lock supabase/functions/_shared/sizeChart.test.ts
// De vijf eerste fixtures zijn de echte Printful-maatgidsen van Loveke (20 okt 2026),
// zonder beschrijvingen/afbeeldingen.
import { buildSizeChart, parseMeasureNumber, publicSizeChart, sellSizesFromVariants, type SizeChart } from './sizeChart.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected ${e}\n  got      ${a}`);
}
const codes = (c: SizeChart) => c.checks.filter((x) => x.level !== 'info').map((x) => x.code);

type V = { size: string; value?: string; min_value?: string; max_value?: string };
const vals = (sizes: string[], xs: (string | [string, string])[]): V[] =>
  sizes.map((size, i) => {
    const x = xs[i];
    return Array.isArray(x) ? { size, min_value: x[0], max_value: x[1] } : { size, value: x };
  });
const table = (type: string, unit: string, ms: Record<string, (string | [string, string])[]>, sizes: string[]) => ({
  type, unit, measurements: Object.entries(ms).map(([type_label, xs]) => ({ type_label, values: vals(sizes, xs) })),
});

// ── Echte Loveke-data ────────────────────────────────────────────────────────
const TEE_S = ['S', 'M', 'L', 'XL', '2XL'];
const tee = {
  available_sizes: TEE_S,
  size_tables: [
    table('measure_yourself', 'cm', { 'Body Length': ['73', '75', '77', '80', '82.5'], 'Sleeve Length': ['24', '24.5', '25', '25.5', '26'], Chest: ['99.06', '109.22', '119.38', '129.54', '139.70'] }, TEE_S),
    table('product_measure', 'cm', { Length: ['73', '75', '77', '80', '82.5'], Width: ['63', '67', '71', '76', '81'], 'Sleeve length': ['24', '24.5', '25', '25.5', '26'] }, TEE_S),
    table('measure_yourself', 'inches', { 'Body Length': ['28.74', '29.53', '30.31', '31.50', '32.48'], Chest: ['39', '43', '47', '51', '55'] }, TEE_S),
    table('product_measure', 'inches', { Length: ['28.74', '29.53', '30.31', '31.50', '32.48'], Width: ['24.80', '26.38', '27.95', '29.92', '31.89'], 'Sleeve length': ['9.45', '9.65', '9.84', '10.04', '10.24'] }, TEE_S),
  ],
};
const HOOD_S = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const hoodie = {
  available_sizes: HOOD_S,
  size_tables: [
    table('product_measure', 'cm', { Length: ['67.95', '69.85', '71.76', '74.93', '77.47', '80.01'], Width: ['57.15', '60.96', '64.77', '69.85', '74.93', '80.01'], 'Sleeve length': ['57.79', '58.42', '59.69', '60.33', '60.96', '61.60'] }, HOOD_S),
    table('product_measure', 'inches', { Length: ['26 3/4', '27 1/2', '28 1/4', '29 1/2', '30 1/2', '31 1/2'], Width: ['22 1/2', '24', '25 1/2', '27 1/2', '29 1/2', '31 1/2'], 'Sleeve length': ['22 3/4', '23', '23 1/2', '23 3/4', '24', '24 1/4'] }, HOOD_S),
  ],
};
const sweat = {
  available_sizes: TEE_S,
  size_tables: [
    table('measure_yourself', 'cm', { 'Body Length': ['68', '72', '74', '76', '78'], 'Chest Circumference': [['83.8 ', ' 91.4'], ['94 ', ' 101.6'], ['104.1 ', ' 109.2'], ['111.8 ', ' 116.8'], ['119.4 ', ' 124.5']], 'Sleeve Length': ['64.5', '66', '67.5', '69', '70.5'] }, TEE_S),
    table('product_measure', 'cm', { 'Body Length': ['68', '72', '74', '76', '78'], 'Chest Width': ['50.5', '53', '56', '59', '62'], 'Sleeve Length': ['64.5', '66', '67.5', '69', '70.5'] }, TEE_S),
    table('product_measure', 'inches', { 'Body Length': ['26.77', '28.35', '29.13', '29.92', '30.71'], 'Chest Width': ['19.88', '20.87', '22.05', '23.23', '24.41'], 'Sleeve Length': ['25.39', '25.98', '26.57', '27.17', '27.76'] }, TEE_S),
  ],
};
const TANK_S = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const tank = {
  available_sizes: TANK_S,
  size_tables: [
    table('measure_yourself', 'cm', { Length: ['66.04', '68.58', '71.12', '73.66', '76.20', '78.74'], Chest: [['78.74', '86.36'], ['86.36', '93.98'], ['96.52', '104.14'], ['106.68', '114.30'], ['116.84', '124.46'], ['127.00', '134.62']] }, TANK_S),
    table('product_measure', 'cm', { Length: ['66.04', '68.58', '71.12', '73.66', '76.20', '78.74'], Width: ['40.64', '45.72', '50.80', '55.88', '60.96', '66.04'] }, TANK_S),
    table('product_measure', 'inches', { Length: ['26', '27', '28', '29', '30', '31'], Width: ['16 ¼', '18 ¼', '20 ¼', '22 ¼', '24 ¼', '26 ¼'] }, TANK_S),
  ],
};
const KID_S = ['12M', '18M', '24M'];
const bodysuit = {
  available_sizes: KID_S,
  size_tables: [
    table('product_measure', 'cm', { Length: ['34.29', '36.83', '39.37'], Width: ['24.77', '27.31', '29.85'] }, KID_S),
    table('product_measure', 'inches', { Length: ['13.5', '14.5', '15.5'], Width: ['9.75', '10.75', '11.75'] }, KID_S),
  ],
};

// ── Getallen ─────────────────────────────────────────────────────────────────
Deno.test('parseMeasureNumber leest alle Printful-notaties', () => {
  eq(parseMeasureNumber('63'), 63);
  eq(parseMeasureNumber(' 91.4'), 91.4);
  eq(parseMeasureNumber('82,5'), 82.5);
  eq(parseMeasureNumber('26 3/4'), 26.75);
  eq(parseMeasureNumber('16 ¼'), 16.25);
  eq(parseMeasureNumber('½'), 0.5);
  eq(parseMeasureNumber('3/4'), 0.75);
  eq(parseMeasureNumber('abc'), null);
  eq(parseMeasureNumber(''), null);
  eq(parseMeasureNumber(undefined), null);
});

// ── Echte producten ──────────────────────────────────────────────────────────
Deno.test('oversized tee: hele cm, borstbereik, pasvorm ruim, status ok', () => {
  const c = buildSizeChart(tee, { sellSizes: TEE_S });
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.columns, ['width', 'length', 'sleeve', 'chest']);
  eq(c.rows.map((r) => [r.size, r.width, r.length, r.sleeve, r.chest_min]), [
    ['S', 63, 73, 24, 99], ['M', 67, 75, 25, 109], ['L', 71, 77, 25, 119], ['XL', 76, 80, 26, 130], ['2XL', 81, 83, 26, 140],
  ]);
  eq(c.fit, 'ruim');
});

Deno.test('hoodie: geen lichaamstabel → geen borstkolom, geen pasvorm, inch-breuken kloppen', () => {
  const c = buildSizeChart(hoodie, { sellSizes: HOOD_S });
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.columns, ['width', 'length', 'sleeve']);
  eq(c.rows.map((r) => [r.size, r.width, r.length]), [['S', 57, 68], ['M', 61, 70], ['L', 65, 72], ['XL', 70, 75], ['2XL', 75, 77], ['3XL', 80, 80]]);
  eq(c.fit, null);
});

Deno.test('sweatshirt: omtrek-bereik met spaties, pasvorm normaal', () => {
  const c = buildSizeChart(sweat, { sellSizes: TEE_S });
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.rows.find((r) => r.size === 'M'), { size: 'M', width: 53, length: 72, sleeve: 66, chest_min: 94, chest_max: 102 });
  eq(c.fit, 'normaal');
});

Deno.test('tanktop: kleine cm/inch-afwijking (0,6 cm) is geen probleem', () => {
  const c = buildSizeChart(tank, { sellSizes: TANK_S });
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.columns, ['width', 'length', 'chest']);
  eq(c.rows.find((r) => r.size === 'L'), { size: 'L', width: 56, length: 74, sleeve: null, chest_min: 107, chest_max: 114 });
});

Deno.test('bodysuit kids: kinderbereiken, variant-sleutel "Variant"', () => {
  const sell = sellSizesFromVariants([{ attribute_values: { Variant: '12M' } }, { attribute_values: { Variant: '18M' } }, { attribute_values: { Variant: '24M' } }]);
  const c = buildSizeChart(bodysuit, { sellSizes: sell });
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.rows.map((r) => [r.size, r.width, r.length]), [['12M', 25, 34], ['18M', 27, 37], ['24M', 30, 39]]);
});

Deno.test('kleur + maat in varianten: alleen verkochte maten, ontbrekende maat gemeld', () => {
  const variants = [{ attribute_values: { Kleur: 'Zwart', Maat: 'M' } }, { attribute_values: { Kleur: 'Wit', Maat: 'L' } }, { attribute_values: { Kleur: 'Wit', Maat: '4XL' } }];
  const c = buildSizeChart(tee, { sellSizes: sellSizesFromVariants(variants) });
  eq(c.rows.map((r) => r.size), ['M', 'L']);
  eq(codes(c), ['SIZE_MISSING']);
  eq(c.status, 'warning');
});

Deno.test('hoodie kids (4Y–12Y): kinderbereiken, borstbereik', () => {
  const Y = ['4Y', '6Y', '8Y', '10Y', '12Y'];
  const g = {
    available_sizes: Y,
    size_tables: [
      table('measure_yourself', 'cm', { Length: ['45.97', '49.02', '52.07', '55.12', '58.17'], Chest: [['60.96', '66.04'], ['66.04', '71.12'], ['71.12', '73.66'], ['73.66', '78.74'], ['78.74', '88.90']] }, Y),
      table('product_measure', 'cm', { Length: ['45.97', '49.02', '52.07', '55.12', '58.17'], Width: ['36.07', '39.12', '41.91', '44.96', '48.01'] }, Y),
      table('product_measure', 'inches', { Length: ['18.1', '19.3', '20.5', '21.7', '22.9'], Width: ['14.2', '15.4', '16.5', '17.7', '18.9'] }, Y),
    ],
  };
  const c = buildSizeChart(g, { sellSizes: Y });
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.rows.map((r) => [r.size, r.width, r.length, r.chest_min, r.chest_max]), [
    ['4Y', 36, 46, 61, 66], ['6Y', 39, 49, 66, 71], ['8Y', 42, 52, 71, 74], ['10Y', 45, 55, 74, 79], ['12Y', 48, 58, 79, 89],
  ]);
});

// ── Foute data: moet geblokkeerd of gemeld worden ────────────────────────────
const S3 = ['S', 'M', 'L'];
const one = (ms: Record<string, (string | [string, string])[]>, unit = 'cm', extra: unknown[] = []) =>
  ({ available_sizes: S3, size_tables: [table('product_measure', unit, ms, S3), ...extra] });

Deno.test('geen maatgids → blocked, en de winkel krijgt niets', () => {
  const c = buildSizeChart(null);
  eq(c.status, 'blocked');
  eq(publicSizeChart(c), null);
});

Deno.test('enkel lichaamsmaten (bv. legging) → blocked: geen kledingmaten', () => {
  const c = buildSizeChart({ size_tables: [table('measure_yourself', 'cm', { Waist: ['70', '76', '82'], Hips: ['90', '96', '102'] }, S3)] });
  eq(codes(c), ['MISSING_GARMENT_MEASURES']);
});

Deno.test('"cm"-tabel die eigenlijk inch is → blocked LOOKS_LIKE_INCHES', () => {
  const c = buildSizeChart(one({ Width: ['20', '22', '24'], Length: ['28', '29', '30'] }));
  eq(c.status, 'blocked');
  eq(codes(c).includes('LOOKS_LIKE_INCHES'), true);
});

Deno.test('breedte die eigenlijk een omtrek is → blocked', () => {
  const c = buildSizeChart(one({ Width: ['100', '108', '116'], Length: ['70', '72', '74'] }));
  eq(codes(c), ['WIDTH_LOOKS_LIKE_CIRCUMFERENCE']);
});

Deno.test('omtrek met duidelijk label → gehalveerd, ok', () => {
  const c = buildSizeChart(one({ 'Chest Circumference': ['100', '108', '116'], Length: ['70', '72', '74'] }));
  eq(c.status, 'ok');
  eq(c.rows.map((r) => r.width), [50, 54, 58]);
});

Deno.test('maat kleiner dan de vorige → blocked NOT_INCREASING', () => {
  const c = buildSizeChart(one({ Width: ['52', '50', '56'], Length: ['70', '72', '74'] }));
  eq(codes(c), ['NOT_INCREASING']);
});

Deno.test('rare sprong tussen maten → warning LARGE_STEP', () => {
  const c = buildSizeChart(one({ Width: ['50', '53', '70'], Length: ['70', '72', '74'] }));
  eq(c.status, 'warning');
  eq(codes(c), ['LARGE_STEP']);
});

Deno.test('cm- en inch-tabel spreken elkaar tegen → warning', () => {
  const c = buildSizeChart(one({ Width: ['50', '53', '56'], Length: ['70', '72', '74'] }, 'cm', [table('product_measure', 'inches', { Width: ['22', '23', '24'], Length: ['27.5', '28.3', '29.1'] }, S3)]));
  eq(codes(c), ['UNIT_TABLES_DISAGREE']);
});

Deno.test('niet-numerieke waarde → blocked', () => {
  const c = buildSizeChart(one({ Width: ['50', 'n.v.t.', '56'], Length: ['70', '72', '74'] }));
  eq(c.status, 'blocked');
  eq(codes(c).includes('VALUE_NOT_NUMERIC'), true);
});

Deno.test('ontbrekende lengte → blocked; onbekend label is enkel info', () => {
  const c = buildSizeChart(one({ Width: ['50', '53', '56'], Inseam: ['70', '72', '74'] }));
  eq(codes(c), ['MISSING_WIDTH_OR_LENGTH']);
  eq(c.checks.some((x) => x.code === 'UNKNOWN_MEASUREMENT' && x.level === 'info'), true);
});

Deno.test('alleen inch-tabel → omgerekend naar cm', () => {
  const c = buildSizeChart(one({ Width: ['20', '21', '22'], Length: ['28', '29', '30'] }, 'inches'));
  eq(c.status, 'ok', JSON.stringify(c.checks));
  eq(c.rows.map((r) => r.width), [51, 53, 56]);
});

Deno.test('maten door elkaar in de bron → in natuurlijke volgorde', () => {
  const c = buildSizeChart({ size_tables: [table('product_measure', 'cm', { Width: ['56', '50', '53'], Length: ['74', '70', '72'] }, ['L', 'S', 'M'])] });
  eq(c.rows.map((r) => r.size), ['S', 'M', 'L']);
  eq(c.status, 'ok');
});

Deno.test('publicSizeChart: blocked → geen rijen online; ok → zonder interne checks', () => {
  const bad = publicSizeChart(buildSizeChart(one({ Width: ['52', '50', '56'], Length: ['70', '72', '74'] })))!;
  eq([bad.status, bad.rows.length], ['blocked', 0]);
  const good = publicSizeChart(buildSizeChart(tee))!;
  eq([good.status, good.rows.length, good.checks.length], ['ok', 5, 0]);
});

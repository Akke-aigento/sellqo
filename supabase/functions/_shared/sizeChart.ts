// SIZECHART-1 — de standaard-maattabel van SellQo.
//
// Zet elke Printful-maatgids (products.size_guide, de ruwe `result` van
// GET /products/{id}/sizes) om naar één vast formaat met vaste kolommen:
//   Breedte  (plat gelegd, oksel tot oksel)
//   Lengte   (hoogste punt van de schouder tot de onderzoom)
//   Mouw
//   Past bij borstomtrek (lichaamsmaat, bereik)
// altijd in hele cm, en controleert de data met factchecks. Niets wordt gegokt:
// een waarde die niet eenduidig uit de bron volgt, komt niet in de tabel.
//
// Puur (geen netwerk, geen DB): gebruikt door storefront-api, apply-printful-import
// en de admin (ProductForm → tab Maattabel, via relatieve import).

export type SizeChartStatus = 'ok' | 'warning' | 'blocked';
export type SizeChartCheckLevel = 'info' | 'warning' | 'blocked';
export type SizeChartFit = 'aansluitend' | 'normaal' | 'ruim' | 'zeer_ruim';
export type SizeChartColumn = 'width' | 'length' | 'sleeve' | 'chest';

export type SizeChartCheckCode =
  | 'NO_SIZE_GUIDE'
  | 'MISSING_GARMENT_MEASURES'
  | 'MISSING_WIDTH_OR_LENGTH'
  | 'VALUE_NOT_NUMERIC'
  | 'VALUE_OUT_OF_RANGE'
  | 'LOOKS_LIKE_INCHES'
  | 'WIDTH_LOOKS_LIKE_CIRCUMFERENCE'
  | 'NOT_INCREASING'
  | 'LARGE_STEP'
  | 'UNIT_TABLES_DISAGREE'
  | 'RANGE_SWAPPED'
  | 'GARMENT_SMALLER_THAN_BODY'
  | 'SIZE_MISSING'
  | 'SIZE_NOT_SOLD'
  | 'UNKNOWN_MEASUREMENT'
  | 'CIRCUMFERENCE_HALVED'
  | 'CONVERTED_FROM_INCHES';

export interface SizeChartCheck {
  code: SizeChartCheckCode;
  level: SizeChartCheckLevel;
  size?: string;
  measure?: string;
  detail?: string;
}

export interface SizeChartRow {
  size: string;
  width: number | null;
  length: number | null;
  sleeve: number | null;
  chest_min: number | null;
  chest_max: number | null;
}

export interface SizeChart {
  version: 1;
  status: SizeChartStatus;
  unit: 'cm';
  fit: SizeChartFit | null;
  columns: SizeChartColumn[];
  rows: SizeChartRow[];
  checks: SizeChartCheck[];
}

export interface BuildSizeChartOptions {
  /** De maten die echt verkocht worden (variantwaarden). Rijen buiten deze set worden verborgen. */
  sellSizes?: string[] | null;
}

// ── Bronvormen (losjes getypeerd: Printful-data is extern) ──────────────────
interface RawValue { size?: unknown; value?: unknown; min_value?: unknown; max_value?: unknown }
interface RawMeasurement { type_label?: unknown; values?: unknown }
interface RawTable { type?: unknown; unit?: unknown; measurements?: unknown }

type Measure = 'width' | 'length' | 'sleeve' | 'chest';

const INCH = 2.54;

// ── Getallen ────────────────────────────────────────────────────────────────
const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅓': 1 / 3, '⅔': 2 / 3,
};

/** "63", "82.5", "82,5", " 91.4", "26 3/4", "16 ¼", "3/4" → getal; anders null. */
export function parseMeasureNumber(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(',', '.');
  if (!s) return null;
  let extra = 0;
  const uni = s.slice(-1);
  if (uni in UNICODE_FRACTIONS) {
    extra = UNICODE_FRACTIONS[uni];
    s = s.slice(0, -1).trim();
    if (!s) return extra;
  }
  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (!den) return null;
    return Number(mixed[1]) + Number(mixed[2]) / den + extra;
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    return den ? Number(frac[1]) / den + extra : null;
  }
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  return Number(s) + extra;
}

// ── Labels ──────────────────────────────────────────────────────────────────
function norm(label: unknown): string {
  return String(label ?? '').toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Labels die een omtrek aanduiden (rondom gemeten). */
function isCircumferenceLabel(l: string): boolean {
  return /circumference|around|girth|omtrek/.test(l);
}

/** Kledingmaat-label → standaardmeting, of null als onbekend. */
export function classifyGarmentLabel(label: unknown): { measure: Measure; circumference: boolean } | null {
  const l = norm(label);
  if (!l) return null;
  if (/sleeve|mouw/.test(l)) return { measure: 'sleeve', circumference: false };
  if (/^(body |total |back |garment )?length$|^lengte$/.test(l)) return { measure: 'length', circumference: false };
  if (/chest|bust|width|borst|breedte|1\/2 chest|half chest/.test(l)) {
    return { measure: 'width', circumference: isCircumferenceLabel(l) };
  }
  return null;
}

/** Lichaamsmaat-label: enkel borst telt; de rest dupliceert kledingmaten. */
export function classifyBodyLabel(label: unknown): 'chest' | 'ignored' {
  const l = norm(label);
  return /chest|bust|borst/.test(l) ? 'chest' : 'ignored';
}

// ── Maten ───────────────────────────────────────────────────────────────────
const LETTER_ORDER = ['xxs', '2xs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', '5xl', '6xl'];

function sizeKey(size: string): string {
  return size.trim().toLowerCase().replace(/\s+/g, '');
}

/** Baby- en kindermaten (12M, 18-24M, 2T, 6Y, NB) hebben andere plausibele bereiken. */
export function isKidsSize(size: string): boolean {
  const k = sizeKey(size);
  return /^(nb|newborn|\d+(-\d+)?(m|mo|mnd|y|yr|yrs|t|j))$/.test(k);
}

function letterRank(size: string): number {
  const k = sizeKey(size).replace(/^xxl$/, '2xl').replace(/^xxxl$/, '3xl').replace(/^xxs$/, '2xs');
  const i = LETTER_ORDER.indexOf(k);
  return i;
}

// Plausibele bereiken in cm. Ruim genomen: ze vangen fouten, geen stijlkeuzes.
const RANGES = {
  adult: { width: [30, 95], length: [40, 125], sleeve: [5, 100], chest: [60, 200] },
  kids: { width: [10, 60], length: [15, 95], sleeve: [3, 70], chest: [30, 110] },
} as const;

// ── Inlezen ─────────────────────────────────────────────────────────────────
interface ParsedTable {
  kind: 'garment' | 'body';
  unit: 'cm' | 'inches';
  // measure → size → waarde in de eenheid van de tabel
  values: Map<Measure, Map<string, { min: number; max: number }>>;
  circumference: Set<Measure>;
}

function readTables(guide: unknown, checks: SizeChartCheck[]): ParsedTable[] {
  const g = guide as { size_tables?: unknown } | null;
  const tables = Array.isArray(g?.size_tables) ? (g!.size_tables as RawTable[]) : [];
  const out: ParsedTable[] = [];
  const unknownSeen = new Set<string>();
  for (const t of tables) {
    const type = String(t?.type ?? '');
    if (type !== 'product_measure' && type !== 'measure_yourself') continue; // 'international' = maatconversie, geen maten
    const u = String(t?.unit ?? '').toLowerCase();
    const unit: 'cm' | 'inches' | null = u.startsWith('cm') ? 'cm' : u.startsWith('inch') ? 'inches' : null;
    if (!unit) continue;
    const kind = type === 'product_measure' ? 'garment' : 'body';
    const parsed: ParsedTable = { kind, unit, values: new Map(), circumference: new Set() };
    const measurements = Array.isArray(t?.measurements) ? (t.measurements as RawMeasurement[]) : [];
    for (const m of measurements) {
      let measure: Measure | null = null;
      let circ = false;
      if (kind === 'garment') {
        const c = classifyGarmentLabel(m?.type_label);
        if (c) { measure = c.measure; circ = c.circumference; }
      } else if (classifyBodyLabel(m?.type_label) === 'chest') {
        measure = 'chest';
      }
      if (!measure) {
        if (kind === 'garment') {
          const label = String(m?.type_label ?? '').trim();
          if (label && !unknownSeen.has(label.toLowerCase())) {
            unknownSeen.add(label.toLowerCase());
            checks.push({ code: 'UNKNOWN_MEASUREMENT', level: 'info', measure: label });
          }
        }
        continue;
      }
      if (parsed.values.has(measure)) continue; // eerste label wint; dubbele labels negeren
      const bySize = new Map<string, { min: number; max: number }>();
      for (const v of (Array.isArray(m?.values) ? (m.values as RawValue[]) : [])) {
        const size = typeof v?.size === 'string' ? v.size.trim() : '';
        if (!size) continue;
        let min: number | null;
        let max: number | null;
        if (v.value !== undefined && v.value !== null && v.value !== '') {
          min = max = parseMeasureNumber(v.value);
        } else {
          min = parseMeasureNumber(v.min_value);
          max = parseMeasureNumber(v.max_value);
          if (min === null) min = max;
          if (max === null) max = min;
        }
        if (min === null || max === null) {
          checks.push({ code: 'VALUE_NOT_NUMERIC', level: 'blocked', size, measure, detail: `${String(v.value ?? v.min_value ?? '')}`.slice(0, 40) });
          continue;
        }
        if (min > max) {
          checks.push({ code: 'RANGE_SWAPPED', level: 'warning', size, measure });
          [min, max] = [max, min];
        }
        bySize.set(size, { min, max });
      }
      parsed.values.set(measure, bySize);
      if (circ) parsed.circumference.add(measure);
    }
    out.push(parsed);
  }
  return out;
}

function pickTable(tables: ParsedTable[], kind: 'garment' | 'body'): ParsedTable | null {
  return tables.find((t) => t.kind === kind && t.unit === 'cm') ?? tables.find((t) => t.kind === kind && t.unit === 'inches') ?? null;
}

function toCm(table: ParsedTable, measure: Measure, size: string): { min: number; max: number } | null {
  const v = table.values.get(measure)?.get(size);
  if (!v) return null;
  const f = table.unit === 'inches' ? INCH : 1;
  let { min, max } = { min: v.min * f, max: v.max * f };
  if (measure === 'width' && table.circumference.has('width')) { min /= 2; max /= 2; }
  return { min, max };
}

function mid(v: { min: number; max: number }): number {
  return (v.min + v.max) / 2;
}

// ── Hoofdfunctie ────────────────────────────────────────────────────────────
export function buildSizeChart(guide: unknown, opts: BuildSizeChartOptions = {}): SizeChart {
  const checks: SizeChartCheck[] = [];
  const empty = (status: SizeChartStatus): SizeChart => ({
    version: 1, status, unit: 'cm', fit: null, columns: [], rows: [], checks,
  });

  if (!guide || typeof guide !== 'object') {
    checks.push({ code: 'NO_SIZE_GUIDE', level: 'blocked' });
    return empty('blocked');
  }

  const tables = readTables(guide, checks);
  const garment = pickTable(tables, 'garment');
  const body = pickTable(tables, 'body');

  if (!garment) {
    checks.push({ code: 'MISSING_GARMENT_MEASURES', level: 'blocked' });
    return empty('blocked');
  }
  if (garment.unit === 'inches') checks.push({ code: 'CONVERTED_FROM_INCHES', level: 'info' });
  if (garment.circumference.has('width')) checks.push({ code: 'CIRCUMFERENCE_HALVED', level: 'info', measure: 'width' });

  // Volgorde van de maten: available_sizes, aangevuld met de volgorde in de tabel.
  const available = (guide as { available_sizes?: unknown }).available_sizes;
  const order: string[] = [];
  for (const s of Array.isArray(available) ? available : []) {
    if (typeof s === 'string' && s.trim() && !order.includes(s.trim())) order.push(s.trim());
  }
  for (const m of garment.values.values()) for (const s of m.keys()) if (!order.includes(s)) order.push(s);
  // Lettermaten in hun natuurlijke volgorde als de bron ze door elkaar geeft.
  if (order.every((s) => letterRank(s) >= 0)) order.sort((a, b) => letterRank(a) - letterRank(b));

  // Verkochte maten: alleen die rijen tonen.
  const sell = (opts.sellSizes ?? []).map((s) => String(s).trim()).filter(Boolean);
  const sellKeys = new Set(sell.map(sizeKey));
  const orderKeys = new Set(order.map(sizeKey));
  let sizes = order;
  if (sellKeys.size > 0) {
    const matched = order.filter((s) => sellKeys.has(sizeKey(s)));
    // Valt geen enkele verkochte waarde samen met een maat (bv. variant = kleur), dan niet filteren.
    if (matched.length > 0) {
      for (const s of order) if (!sellKeys.has(sizeKey(s))) checks.push({ code: 'SIZE_NOT_SOLD', level: 'info', size: s });
      for (const s of sell) if (!orderKeys.has(sizeKey(s)) && looksLikeSizeToken(s)) checks.push({ code: 'SIZE_MISSING', level: 'warning', size: s });
      sizes = matched;
    }
  }

  const kids = sizes.length > 0 && sizes.every(isKidsSize);
  const range = kids ? RANGES.kids : RANGES.adult;

  const rows: SizeChartRow[] = [];
  const exact: Array<{ width: number | null; length: number | null; sleeve: number | null; chest: { min: number; max: number } | null }> = [];
  for (const size of sizes) {
    const w = toCm(garment, 'width', size);
    const l = toCm(garment, 'length', size);
    const sl = toCm(garment, 'sleeve', size);
    const ch = body ? toCm(body, 'chest', size) : null;
    exact.push({ width: w ? mid(w) : null, length: l ? mid(l) : null, sleeve: sl ? mid(sl) : null, chest: ch });
    rows.push({
      size,
      width: w ? Math.round(mid(w)) : null,
      length: l ? Math.round(mid(l)) : null,
      sleeve: sl ? Math.round(mid(sl)) : null,
      chest_min: ch ? Math.round(ch.min) : null,
      chest_max: ch ? Math.round(ch.max) : null,
    });
  }

  // ── Factchecks ────────────────────────────────────────────────────────────
  if (rows.length === 0 || rows.some((r) => r.width === null || r.length === null)) {
    const missing = rows.filter((r) => r.width === null || r.length === null).map((r) => r.size);
    checks.push({ code: 'MISSING_WIDTH_OR_LENGTH', level: 'blocked', detail: missing.join(', ') || undefined });
  }

  // Bereik + inch-vermoeden.
  for (const m of ['width', 'length', 'sleeve'] as const) {
    const vals = exact.map((e, i) => ({ v: e[m], size: rows[i].size })).filter((x) => x.v !== null) as { v: number; size: string }[];
    if (vals.length === 0) continue;
    const [lo, hi] = range[m];
    const out = vals.filter((x) => x.v < lo || x.v > hi);
    if (out.length === 0) continue;
    const allTooSmall = vals.every((x) => x.v < lo);
    if (allTooSmall && vals.every((x) => x.v * INCH >= lo && x.v * INCH <= hi)) {
      checks.push({ code: 'LOOKS_LIKE_INCHES', level: 'blocked', measure: m });
    } else if (m === 'width' && out.every((x) => x.v > hi) && out.every((x) => x.v / 2 >= lo && x.v / 2 <= hi)) {
      checks.push({ code: 'WIDTH_LOOKS_LIKE_CIRCUMFERENCE', level: 'blocked', measure: m });
    } else {
      for (const x of out) checks.push({ code: 'VALUE_OUT_OF_RANGE', level: 'blocked', size: x.size, measure: m, detail: String(Math.round(x.v)) });
    }
  }
  const chestVals = exact.filter((e) => e.chest).map((e) => e.chest!);
  if (chestVals.some((c) => c.min < range.chest[0] || c.max > range.chest[1])) {
    checks.push({ code: 'VALUE_OUT_OF_RANGE', level: 'warning', measure: 'chest' });
  }

  // Elke maat groter dan (of gelijk aan) de vorige, met logische stappen.
  for (const m of ['width', 'length'] as const) {
    for (let i = 1; i < exact.length; i++) {
      const a = exact[i - 1][m];
      const b = exact[i][m];
      if (a === null || b === null) continue;
      if (b < a - 0.5) checks.push({ code: 'NOT_INCREASING', level: 'blocked', size: rows[i].size, measure: m });
      else if (b - a > 12) checks.push({ code: 'LARGE_STEP', level: 'warning', size: rows[i].size, measure: m, detail: String(Math.round(b - a)) });
    }
  }

  // cm- en inch-tabel moeten hetzelfde zeggen.
  const garmentCm = tables.find((t) => t.kind === 'garment' && t.unit === 'cm');
  const garmentIn = tables.find((t) => t.kind === 'garment' && t.unit === 'inches');
  if (garmentCm && garmentIn) {
    let flagged = false;
    for (const m of ['width', 'length', 'sleeve'] as const) {
      for (const size of sizes) {
        const c = toCm(garmentCm, m, size);
        const i = toCm(garmentIn, m, size);
        if (!c || !i) continue;
        const diff = Math.abs(mid(c) - mid(i));
        if (diff > Math.max(1.5, mid(c) * 0.03)) {
          if (!flagged) checks.push({ code: 'UNIT_TABLES_DISAGREE', level: 'warning', size, measure: m, detail: `${mid(c).toFixed(1)} cm ↔ ${mid(i).toFixed(1)} cm` });
          flagged = true;
        }
      }
    }
  }

  // Kledingstuk kleiner dan het lichaam waarvoor het bedoeld is? (kan bij stretch, maar nakijken)
  exact.forEach((e, i) => {
    if (e.width !== null && e.chest && e.width * 2 < e.chest.min - 6) {
      checks.push({ code: 'GARMENT_SMALLER_THAN_BODY', level: 'warning', size: rows[i].size });
    }
  });

  // Pasvorm (afgeleid): ruimte rond de borst = omtrek kledingstuk − borstomtrek lichaam, mediaan.
  let fit: SizeChartFit | null = null;
  const eases = exact.filter((e) => e.width !== null && e.chest).map((e) => e.width! * 2 - mid(e.chest!)).sort((a, b) => a - b);
  if (eases.length > 0) {
    const med = eases[Math.floor(eases.length / 2)];
    fit = med <= 5 ? 'aansluitend' : med <= 15 ? 'normaal' : med <= 25 ? 'ruim' : 'zeer_ruim';
  }

  const columns: SizeChartColumn[] = [];
  if (rows.some((r) => r.width !== null)) columns.push('width');
  if (rows.some((r) => r.length !== null)) columns.push('length');
  if (rows.some((r) => r.sleeve !== null)) columns.push('sleeve');
  if (rows.some((r) => r.chest_min !== null)) columns.push('chest');

  const status: SizeChartStatus = checks.some((c) => c.level === 'blocked')
    ? 'blocked'
    : checks.some((c) => c.level === 'warning') ? 'warning' : 'ok';

  return { version: 1, status, unit: 'cm', fit, columns, rows, checks };
}

function looksLikeSizeToken(s: string): boolean {
  return letterRank(s) >= 0 || isKidsSize(s) || /^\d{2,3}$/.test(sizeKey(s));
}

/** Haalt de verkochte maten uit variantwaarden (sleutel Maat/Size/Taille/Größe, of elke waarde als fallback). */
export function sellSizesFromVariants(variants: Array<{ attribute_values?: unknown }> | null | undefined): string[] {
  const out: string[] = [];
  for (const v of variants ?? []) {
    const attrs = v?.attribute_values;
    if (!attrs || typeof attrs !== 'object') continue;
    for (const val of Object.values(attrs as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim() && !out.includes(val.trim())) out.push(val.trim());
    }
  }
  return out;
}

/** Wat de winkel krijgt: geblokkeerde tabellen gaan nooit online (rijen leeg). */
export function publicSizeChart(chart: SizeChart): SizeChart | null {
  if (chart.checks.some((c) => c.code === 'NO_SIZE_GUIDE')) return null;
  if (chart.status === 'blocked') return { ...chart, rows: [], columns: [], fit: null, checks: chart.checks.filter((c) => c.level === 'blocked').map(({ code, level }) => ({ code, level })) };
  return { ...chart, checks: [] };
}

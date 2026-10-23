// KASSA-0 — geld en hoeveelheden als gehele getallen. Nooit met floats rekenen.
//
// - bedragen: centen (1 = €0,01). Het schema eist veelvouden van 0,01.
// - unitPrice en quantity: tienduizendsten (1 = 0,0001). Het schema laat 4 decimalen toe.
//
// Over de lijn gaan ze als JSON-getal (GraphQL Float). `toJsonAmount` geeft een getal dat
// exact zo geserialiseerd wordt als de officiële voorbeelden (24, 19.83, -0.01).

export type Cents = number;
export type Milli4 = number; // 1/10000

const EPS = 1e-6;

function scale(value: number, factor: number, what: string): number {
  if (!Number.isFinite(value)) throw new Error(`${what}: geen eindig getal (${value})`);
  const scaled = value * factor;
  const r = Math.round(scaled);
  if (Math.abs(scaled - r) > EPS * factor) {
    throw new Error(`${what}: ${value} heeft meer decimalen dan toegelaten (1/${factor})`);
  }
  if (!Number.isSafeInteger(r)) throw new Error(`${what}: ${value} is te groot`);
  return r === 0 ? 0 : r; // geen -0
}

/** JSON-bedrag → centen. Gooit bij meer dan 2 decimalen. */
export function cents(value: number): Cents {
  return scale(value, 100, 'bedrag');
}
/** JSON-hoeveelheid of -eenheidsprijs → tienduizendsten. Gooit bij meer dan 4 decimalen. */
export function milli4(value: number): Milli4 {
  return scale(value, 10_000, 'hoeveelheid/eenheidsprijs');
}

export function fromCents(c: Cents): number {
  if (!Number.isSafeInteger(c)) throw new Error(`centen moeten een geheel getal zijn (${c})`);
  const v = c / 100;
  return v === 0 ? 0 : v;
}
export function fromMilli4(m: Milli4): number {
  if (!Number.isSafeInteger(m)) throw new Error(`tienduizendsten moeten een geheel getal zijn (${m})`);
  const v = m / 10_000;
  return v === 0 ? 0 : v;
}

/**
 * Deling van gehele getallen, afgerond "half up" weg van nul (zoals Decimal ROUND_HALF_UP).
 * Bewezen gedrag van de FDM op de btw: 145/145 officiële antwoorden.
 */
export function divRoundHalfUp(num: number, den: number): number {
  if (den === 0) throw new Error('deling door nul');
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) throw new Error('divRoundHalfUp: enkel gehele getallen');
  const sign = (num < 0) !== (den < 0) ? -1 : 1;
  const n = Math.abs(num);
  const d = Math.abs(den);
  let q = Math.floor(n / d);
  const r = n - q * d;
  if (r * 2 >= d) q += 1;
  const out = sign * q;
  return out === 0 ? 0 : out;
}

/** hoeveelheid × eenheidsprijs (beide in 1/10000) → centen, enkel als het exact uitkomt. */
export function lineAmountCents(quantity: Milli4, unitPrice: Milli4): Cents | null {
  // q×p in 1/10^8; centen = /10^6. BigInt om overloop te vermijden.
  const prod = BigInt(quantity) * BigInt(unitPrice);
  const div = 1_000_000n;
  if (prod % div !== 0n) return null;
  const c = Number(prod / div);
  return c === 0 ? 0 : c;
}

export function sumCents(values: Cents[]): Cents {
  let s = 0;
  for (const v of values) s += v;
  return s === 0 ? 0 : s;
}

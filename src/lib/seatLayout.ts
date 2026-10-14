// ZAAL-1 — pure logica voor het stoelplan van een zaal: rijen genereren, nummeren en
// centreren. Los van React en Supabase, zodat het met vitest getest kan worden.

export type SeatKind = 'seat' | 'wheelchair' | 'companion';
export type Numbering = 'ltr' | 'rtl' | 'oddeven';

export interface LayoutSeat {
  id: string;
  section_id: string;
  price_class_id: string | null;
  row_label: string;
  seat_number: string;
  x: number;
  y: number;
  kind: SeatKind;
  sellable: boolean;
}

/** A, B, …, Z, AA, AB… of 1, 2, 3… als de start een getal is. */
export function rowLabels(start: string, count: number): string[] {
  const n = Math.max(0, Math.min(200, Math.floor(count)));
  const s = start.trim().toUpperCase() || 'A';
  if (/^\d+$/.test(s)) return Array.from({ length: n }, (_, i) => String(Number(s) + i));
  const toNum = (str: string) => [...str].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  const toStr = (num: number) => {
    let out = '';
    let v = num;
    while (v > 0) { const r = (v - 1) % 26; out = String.fromCharCode(65 + r) + out; v = Math.floor((v - 1) / 26); }
    return out;
  };
  const base = /^[A-Z]+$/.test(s) ? toNum(s) : 1;
  return Array.from({ length: n }, (_, i) => toStr(base + i));
}

/** Nummers voor N stoelen van links naar rechts. */
export function seatNumbers(count: number, numbering: Numbering): string[] {
  const n = Math.max(0, Math.floor(count));
  if (numbering === 'rtl') return Array.from({ length: n }, (_, i) => String(n - i));
  if (numbering === 'oddeven') {
    // Links oneven (…5, 3, 1), rechts even (2, 4, 6…), zoals in veel Belgische zalen.
    const left = Math.ceil(n / 2);
    const out: string[] = [];
    for (let i = 0; i < left; i++) out.push(String(2 * (left - i) - 1));
    for (let i = 0; i < n - left; i++) out.push(String(2 * (i + 1)));
    return out;
  }
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

export interface GenerateInput {
  sectionId: string;
  rows: number;
  perRow: number;
  /** Gangpad na deze stoelposities (1-gebaseerd, van links), bv. [11]. */
  aisleAfter: number[];
  startLabel: string;
  numbering: Numbering;
  startY: number;
  offsetX: number;
  priceClassId: string | null;
  newId: () => string;
}

/** Breedte in roostercellen van één rij met gangpaden. */
export function rowWidth(perRow: number, aisleAfter: number[]): number {
  return perRow + aisleAfter.filter((a) => a > 0 && a < perRow).length;
}

export function generateSection(input: GenerateInput): LayoutSeat[] {
  const labels = rowLabels(input.startLabel, input.rows);
  const numbers = seatNumbers(input.perRow, input.numbering);
  const aisles = new Set(input.aisleAfter.filter((a) => a > 0 && a < input.perRow));
  const out: LayoutSeat[] = [];
  labels.forEach((label, r) => {
    let x = input.offsetX;
    for (let i = 0; i < input.perRow; i++) {
      out.push({
        id: input.newId(),
        section_id: input.sectionId,
        price_class_id: input.priceClassId,
        row_label: label,
        seat_number: numbers[i],
        x,
        y: input.startY + r,
        kind: 'seat',
        sellable: true,
      });
      x += 1;
      if (aisles.has(i + 1)) x += 1;
    }
  });
  return out;
}

export function bounds(seats: Pick<LayoutSeat, 'x' | 'y'>[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (seats.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of seats) {
    if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Plaats voor een (her)gegenereerde sectie: onder de secties die erboven staan, met één
 * lege rij tussen, en gecentreerd ten opzichte van de breedste sectie.
 */
export function placeSection(
  otherSeats: Pick<LayoutSeat, 'x' | 'y'>[],
  width: number,
  keepY: number | null,
): { startY: number; offsetX: number } {
  const b = bounds(otherSeats);
  const venueWidth = Math.max(width, b ? b.maxX + 1 : 0);
  const offsetX = Math.max(0, Math.floor((venueWidth - width) / 2));
  const startY = keepY ?? (b ? b.maxY + 2 : 0);
  return { startY, offsetX };
}

export function seatLabel(s: Pick<LayoutSeat, 'row_label' | 'seat_number'>): string {
  return `${s.row_label} ${s.seat_number}`;
}

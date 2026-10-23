// ZAAL-H1 — pure geometrie voor het zaalplan: raster-snap, draaien, binnen de ruimte
// houden, overlap zoeken en schalen naar een scherm. Los van React, getest met vitest.
import type { FloorArea, Placed } from './types';

export interface Box { x: number; y: number; w: number; h: number }

/** Afronden naar de dichtstbijzijnde rastereenheid (stap 1 = hele cellen). */
export function snap(v: number, step = 1): number {
  if (!Number.isFinite(v)) return 0;
  const s = step > 0 ? step : 1;
  return Math.round(v / s) * s;
}

/** Rotatie normaliseren naar 0..359, in stappen van 45°. */
export function normRotation(deg: number): number {
  const r = Math.round((Number.isFinite(deg) ? deg : 0) / 45) * 45;
  return ((r % 360) + 360) % 360;
}

/**
 * Omhullende rechthoek na het draaien (rond het middelpunt). Bij 90/270 wisselen breedte
 * en hoogte; bij 45° nemen we het kleinste vierkant dat de gedraaide vorm bevat.
 */
export function rotatedBox(p: Pick<Placed, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Box {
  const r = normRotation(p.rotation);
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  let w = p.w;
  let h = p.h;
  if (r === 90 || r === 270) { w = p.h; h = p.w; }
  else if (r % 90 !== 0) { const d = (p.w + p.h) / Math.SQRT2; w = d; h = d; }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Raken twee rechthoeken elkaar echt (aangrenzend telt niet als overlap)? */
export function boxesOverlap(a: Box, b: Box): boolean {
  const eps = 1e-6;
  return a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
}

/** Paren van ids die overlappen (elk paar één keer). Voor de waarschuwing in de editor. */
export function findOverlaps(items: Placed[]): [string, string][] {
  const boxes = items.map((i) => ({ id: i.id, b: rotatedBox(i) }));
  const out: [string, string][] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i].b, boxes[j].b)) out.push([boxes[i].id, boxes[j].id]);
    }
  }
  return out;
}

/** Set van ids die met iets overlappen. */
export function overlappingIds(items: Placed[]): Set<string> {
  const s = new Set<string>();
  for (const [a, b] of findOverlaps(items)) { s.add(a); s.add(b); }
  return s;
}

/**
 * Positie binnen de ruimte houden: x/y zo verschuiven dat de (gedraaide) vorm volledig
 * binnen 0..grid_w × 0..grid_h valt, en afronden op hele cellen.
 */
export function clampToArea<T extends Pick<Placed, 'x' | 'y' | 'w' | 'h' | 'rotation'>>(p: T, area: Pick<FloorArea, 'grid_w' | 'grid_h'>): T {
  const w = Math.max(1, Math.min(p.w, area.grid_w));
  const h = Math.max(1, Math.min(p.h, area.grid_h));
  const sized = { ...p, w, h };
  const b = rotatedBox(sized);
  let dx = 0;
  let dy = 0;
  if (b.x < 0) dx = -b.x; else if (b.x + b.w > area.grid_w) dx = area.grid_w - (b.x + b.w);
  if (b.y < 0) dy = -b.y; else if (b.y + b.h > area.grid_h) dy = area.grid_h - (b.y + b.h);
  // Op hele cellen; de databank kent enkel gehele x/y ≥ 0.
  let x = Math.round(sized.x + dx);
  let y = Math.round(sized.y + dy);
  // Afronden kan een halve cel buiten duwen (oneven maat, 90° gedraaid): corrigeer.
  const rb = rotatedBox({ ...sized, x, y });
  if (rb.x < 0) x += Math.ceil(-rb.x);
  if (rb.y < 0) y += Math.ceil(-rb.y);
  if (rb.x + rb.w > area.grid_w) x -= Math.ceil(rb.x + rb.w - area.grid_w);
  if (rb.y + rb.h > area.grid_h) y -= Math.ceil(rb.y + rb.h - area.grid_h);
  return { ...sized, x: Math.max(0, x), y: Math.max(0, y) };
}

/** Pixelverschuiving tijdens slepen → nieuwe rasterpositie (gesnapt). */
export function dragTo(start: { x: number; y: number }, dxPx: number, dyPx: number, cellPx: number): { x: number; y: number } {
  const c = cellPx > 0 ? cellPx : 1;
  return { x: snap(start.x + dxPx / c), y: snap(start.y + dyPx / c) };
}

/**
 * Celgrootte in pixels zodat de hele ruimte in het beschikbare vak past (breedte én,
 * als opgegeven, hoogte). Nooit kleiner dan minCell, zodat tafels aanklikbaar blijven.
 */
export function fitCell(area: Pick<FloorArea, 'grid_w' | 'grid_h'>, widthPx: number, heightPx?: number, minCell = 8, maxCell = 48): number {
  const byW = widthPx / Math.max(1, area.grid_w);
  const byH = heightPx && heightPx > 0 ? heightPx / Math.max(1, area.grid_h) : Infinity;
  const c = Math.floor(Math.min(byW, byH));
  return Math.max(minCell, Math.min(maxCell, Number.isFinite(c) ? c : minCell));
}

/**
 * Eerste vrije plek (van linksboven, rij per rij) waar een vorm van w×h past zonder
 * overlap. null als er geen plek is. Gebruikt bij "tafel toevoegen" en "dupliceren".
 */
export function findFreeSpot(area: Pick<FloorArea, 'grid_w' | 'grid_h'>, others: Placed[], w: number, h: number, near?: { x: number; y: number }): { x: number; y: number } | null {
  const boxes = others.map(rotatedBox);
  const fits = (x: number, y: number) => {
    const b = { x, y, w, h };
    return x + w <= area.grid_w && y + h <= area.grid_h && !boxes.some((o) => boxesOverlap(b, o));
  };
  if (near) {
    // Eerst rechts ernaast, dan eronder: dupliceren komt dan logisch naast het origineel.
    for (const [x, y] of [[near.x + w, near.y], [near.x, near.y + h]]) {
      if (x >= 0 && y >= 0 && fits(x, y)) return { x, y };
    }
  }
  for (let y = 0; y + h <= area.grid_h; y++) {
    for (let x = 0; x + w <= area.grid_w; x++) {
      if (fits(x, y)) return { x, y };
    }
  }
  return null;
}

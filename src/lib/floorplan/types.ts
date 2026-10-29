// ZAAL-H1 — types van het horeca-zaalplan (tabellen dining_areas, dining_tables,
// floor_markers). Alle posities en maten zijn rastereenheden, nooit pixels: het plan
// schaalt zo naar elk scherm (gsm, tablet aan de toog, kassascherm).

export type TableKind = 'table' | 'bar_seat' | 'standing';
export type TableShape = 'round' | 'square' | 'rect';
export type MarkerKind = 'bar' | 'door' | 'wall' | 'plant' | 'text';

export const TABLE_KINDS: TableKind[] = ['table', 'bar_seat', 'standing'];
export const TABLE_SHAPES: TableShape[] = ['round', 'square', 'rect'];
export const MARKER_KINDS: MarkerKind[] = ['bar', 'door', 'wall', 'plant', 'text'];

export interface FloorArea {
  id: string;
  name: string;
  sort: number;
  grid_w: number;
  grid_h: number;
  is_active: boolean;
}

/** Iets met een plek op het raster (tafel of decor). x/y = linkerbovenhoek vóór het draaien. */
export interface Placed {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface FloorTable extends Placed {
  area_id: string;
  label: string;
  kind: TableKind;
  shape: TableShape;
  seats: number;
  is_active: boolean;
}

/** Zoals in de databank, mét qr_token (enkel in de beheer-UI; nooit naar de storefront). */
export interface FloorTableRow extends FloorTable {
  qr_token: string;
}

export interface FloorMarker extends Placed {
  area_id: string;
  kind: MarkerKind;
  label: string | null;
}

/** Live status per tafel (TAFEL-1): vrij, bezet, wil afrekenen… Kleur komt uit het component. */
/** KASSA-UX-1: 'bill' = rekening gevraagd (blauw); 'attention' = QR-bestelling wacht (amber). */
export type TableStatus = 'free' | 'occupied' | 'attention' | 'reserved' | 'bill';

/** Grenzen uit de migratie (checks op dining_areas/dining_tables). */
export const GRID_LIMITS = {
  minW: 8, maxW: 120, minH: 6, maxH: 80,
  tableMaxSize: 40, seatsMax: 99, labelMax: 16,
} as const;

export const DEFAULT_GRID = { w: 40, h: 24 } as const;

/** Zelfde regel als de check in de migratie: begint met letter/cijfer, max. 16 tekens. */
export const LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9 _./-]{0,15}$/;

// ZAAL-H1 — sjablonen: in één klik een rij barkrukken met toog, een terras van N tafels
// of een rij binnentafels. Geeft nieuwe items terug (zonder id), geplaatst op de eerste
// vrije plek in de ruimte. De editor bewaart ze daarna.
import { findFreeSpot } from './geometry';
import { labelSeries } from './labels';
import type { FloorArea, FloorTable, MarkerKind, Placed, TableKind, TableShape } from './types';

export type TemplateId = 'bar_row' | 'terrace' | 'table_row';
export const TEMPLATE_IDS: TemplateId[] = ['bar_row', 'terrace', 'table_row'];

export interface TemplateInput {
  id: TemplateId;
  /** Aantal stuks (barkrukken, tafels). */
  count: number;
  /** Voorvoegsel voor de labels ("B", "Ter-", ""). */
  prefix: string;
  /** Terras: aantal kolommen (rijen volgen uit count). */
  columns?: number;
}

export interface NewTable { label: string; kind: TableKind; shape: TableShape; seats: number; x: number; y: number; w: number; h: number; rotation: number }
export interface NewMarker { kind: MarkerKind; label: string | null; x: number; y: number; w: number; h: number; rotation: number }

export const TEMPLATE_DEFAULTS: Record<TemplateId, { count: number; prefix: string; columns?: number }> = {
  bar_row: { count: 9, prefix: 'B' },
  terrace: { count: 4, prefix: 'Ter-', columns: 4 },
  table_row: { count: 5, prefix: '' },
};

const clampCount = (n: number) => Math.max(1, Math.min(40, Math.floor(Number.isFinite(n) ? n : 1)));

/** Het sjabloon relatief op (0,0): tafels, decor en de omhullende maat. */
export function buildTemplate(input: TemplateInput, existingLabels: string[]): { tables: NewTable[]; markers: NewMarker[]; w: number; h: number } {
  const count = clampCount(input.count);
  const labels = labelSeries(existingLabels, input.prefix, count);
  if (input.id === 'bar_row') {
    // Toog (1 cel diep) met eronder de krukken, één cel per kruk.
    const tables = labels.map((label, i) => ({ label, kind: 'bar_seat' as const, shape: 'round' as const, seats: 1, x: i, y: 1, w: 1, h: 1, rotation: 0 }));
    return { tables, markers: [{ kind: 'bar', label: null, x: 0, y: 0, w: count, h: 1, rotation: 0 }], w: count, h: 2 };
  }
  if (input.id === 'terrace') {
    const cols = Math.max(1, Math.min(count, Math.floor(input.columns ?? 4)));
    // 2×2-tafels met één cel tussenruimte.
    const tables = labels.map((label, i) => ({
      label, kind: 'table' as const, shape: 'square' as const, seats: 4,
      x: (i % cols) * 3, y: Math.floor(i / cols) * 3, w: 2, h: 2, rotation: 0,
    }));
    const rows = Math.ceil(count / cols);
    return { tables, markers: [], w: cols * 3 - 1, h: rows * 3 - 1 };
  }
  const tables = labels.map((label, i) => ({ label, kind: 'table' as const, shape: 'square' as const, seats: 4, x: i * 3, y: 0, w: 2, h: 2, rotation: 0 }));
  return { tables, markers: [], w: count * 3 - 1, h: 2 };
}

/**
 * Sjabloon op de eerste plek waar het in zijn geheel past zonder iets te overlappen.
 * null als de ruimte te klein of te vol is (de editor meldt dat).
 */
export function placeTemplate(
  input: TemplateInput,
  area: Pick<FloorArea, 'grid_w' | 'grid_h'>,
  tables: Pick<FloorTable, 'label'>[],
  occupied: Placed[],
): { tables: NewTable[]; markers: NewMarker[] } | null {
  const t = buildTemplate(input, tables.map((x) => x.label));
  if (t.w > area.grid_w || t.h > area.grid_h) return null;
  const spot = findFreeSpot(area, occupied, t.w, t.h);
  if (!spot) return null;
  return {
    tables: t.tables.map((x) => ({ ...x, x: x.x + spot.x, y: x.y + spot.y })),
    markers: t.markers.map((m) => ({ ...m, x: m.x + spot.x, y: m.y + spot.y })),
  };
}

/** Standaardmaat per soort tafel bij "toevoegen". */
export function defaultTable(kind: TableKind): Pick<NewTable, 'kind' | 'shape' | 'seats' | 'w' | 'h'> {
  if (kind === 'bar_seat') return { kind, shape: 'round', seats: 1, w: 1, h: 1 };
  if (kind === 'standing') return { kind, shape: 'round', seats: 0, w: 1, h: 1 };
  // VASTE-KLANT-1: een pil met de naam, breed genoeg om te lezen.
  if (kind === 'regular') return { kind, shape: 'rect', seats: 1, w: 3, h: 1 };
  return { kind, shape: 'square', seats: 4, w: 2, h: 2 };
}

/** Standaardmaat per soort decor. */
export function defaultMarker(kind: MarkerKind): Pick<NewMarker, 'kind' | 'w' | 'h'> {
  if (kind === 'bar') return { kind, w: 8, h: 1 };
  if (kind === 'wall') return { kind, w: 10, h: 1 };
  if (kind === 'door') return { kind, w: 2, h: 1 };
  if (kind === 'plant') return { kind, w: 1, h: 1 };
  return { kind, w: 4, h: 1 };
}

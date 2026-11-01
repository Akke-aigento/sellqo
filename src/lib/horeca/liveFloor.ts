// HORECA-ZIJBALK-1 — het live zaaloverzicht in het beheer (/admin/zaal): welke tafels open staan,
// voor hoeveel, hoe lang en in welke stand. Puur (geen data-ophaling), zodat het getest kan worden.
//
// Zelfde regels als de kassa (src/kassa/app/screens/TablesScreen.tsx), niet gekopieerd maar gevolgd:
// - per tafel telt de hoofdrekening; is die al betaald maar een deelrekening nog niet, dan het deel;
// - bedrag = checkTotalCents (alle niet-geschrapte lijnen, ontwerp inbegrepen), zodat beheer en
//   kassa hetzelfde getal tonen;
// - status: rekening gevraagd = 'bill', anders 'occupied'.
// Read-only: niets hier opent, wijzigt of sluit een rekening.
import { checkTotalCents, type Check } from '@/kassa/app/horeca/types';
import type { TableStatus } from '@/lib/floorplan';

/** Waar het zaalplan bewerkt wordt (vroeger /admin/bestellen?tab=zaal). */
export const FLOOR_EDIT_URL = '/admin/zaal?tab=bewerken';

export type LiveState = 'open' | 'bill' | 'paying';

export interface LiveRow {
  checkId: string;
  tableId: string | null;
  /** Naam van de tafel, of de naam op de rekening (op naam / toog). */
  label: string;
  /** Deelrekening (apart afrekenen): volgnummer, anders null. */
  part: number | null;
  counter: boolean;
  state: LiveState;
  totalCents: number;
  openedAt: string;
  minutesOpen: number;
  guests: number | null;
}

export interface LiveFloor {
  rows: LiveRow[];
  /** Kleur per tafel-id voor FloorPlanView. */
  status: Record<string, TableStatus>;
  /** Regel per tafel-id: "€ 42,50 · 35′". */
  badges: Record<string, string>;
  openTables: number;
  openChecks: number;
  totalCents: number;
}

/** Hele minuten sinds een tijdstip (nooit negatief). */
export function minutesOpen(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function liveState(c: Pick<Check, 'paying' | 'bill_requested_at'>): LiveState {
  if (c.paying) return 'paying';
  return c.bill_requested_at ? 'bill' : 'open';
}

export function buildLiveFloor(
  checks: Check[],
  tableLabel: (id: string) => string | null,
  opts: { now: number; money: (cents: number) => string; counterLabel: string; unnamedLabel: string },
): LiveFloor {
  const open = checks.filter((c) => c.status === 'open');
  const byTable = new Map<string, Check>();
  for (const c of open) if (c.table_id && !c.split_of) byTable.set(c.table_id, c);
  for (const c of open) if (c.table_id && c.split_of && !byTable.has(c.table_id)) byTable.set(c.table_id, c);

  const status: Record<string, TableStatus> = {};
  const badges: Record<string, string> = {};
  for (const [tableId, c] of byTable) {
    status[tableId] = c.bill_requested_at || c.paying ? 'bill' : 'occupied';
    badges[tableId] = `${opts.money(checkTotalCents(c))} · ${minutesOpen(c.opened_at, opts.now)}′`;
  }

  const rows: LiveRow[] = open
    .map((c) => {
      const counter = c.kind === 'counter';
      const label = (c.table_id ? tableLabel(c.table_id) : null) ?? c.name ?? (counter ? opts.counterLabel : opts.unnamedLabel);
      return {
        checkId: c.id,
        tableId: c.table_id,
        label,
        part: c.split_no ?? null,
        counter,
        state: liveState(c),
        totalCents: checkTotalCents(c),
        openedAt: c.opened_at,
        minutesOpen: minutesOpen(c.opened_at, opts.now),
        guests: c.guests,
      };
    })
    // Langst open eerst: daar kijkt een zaakvoerder naar.
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt));

  return {
    rows,
    status,
    badges,
    openTables: byTable.size,
    openChecks: open.length,
    totalCents: rows.reduce((s, r) => s + r.totalCents, 0),
  };
}

/** "35 min" of "1 u 05": i18n-keys met {{m}} en {{h}}. */
export function durationParts(minutes: number): { h: number; m: number; mm: string } {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { h, m, mm: String(m).padStart(2, '0') };
}

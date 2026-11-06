// TAFEL-SAMEN-1 — waarschuwingen in Zaal › Live en op het Nu-paneel over rekeningen die niet (enkel) van de
// gasten van nu zijn. Puur (geen data-ophaling), zodat het getest kan worden. Bron: horeca_table_groups.
//   - stale:  de rekening is open sinds vóór de laatste dagreset (05:00) — "Open sinds gisteren";
//   - prev:   er staan nog lijnen open van vóór de start van de gasten die nu aan tafel zitten (tafelgroep)
//             — "Lijnen van vorige gasten". De gasten zien die niet en kunnen ze niet betalen.
// Afsluiten of verplaatsen gebeurt altijd op de kassa (ondertekend); "Tafel vrijgeven" raakt enkel de groep.

export interface TableGroupRow {
  table_id: string | null;
  check_id: string | null;
  check_opened_at: string | null;
  stale: boolean;
  prev_open_lines: number;
  group: { id: string; started_at: string; last_activity_at: string } | null;
}
export interface TableGroupsData { last_reset: string | null; tables: TableGroupRow[] }

export interface CheckWarning {
  stale: boolean;
  prevLines: number;
  /** Er zit nu een tafelgroep (QR) aan deze tafel: "Tafel vrijgeven" kan. */
  groupActive: boolean;
  groupStartedAt: string | null;
  tableId: string | null;
}

/** Per open hoofdrekening (check_id) de waarschuwingen. Rekeningen zonder iets te melden ontbreken. */
export function checkWarnings(data: TableGroupsData | null | undefined): Map<string, CheckWarning> {
  const out = new Map<string, CheckWarning>();
  for (const r of data?.tables ?? []) {
    if (!r.check_id) continue;
    const prev = Math.max(0, Number(r.prev_open_lines) || 0);
    if (!r.stale && prev === 0 && !r.group) continue;
    out.set(r.check_id, { stale: !!r.stale, prevLines: prev, groupActive: !!r.group, groupStartedAt: r.group?.started_at ?? null, tableId: r.table_id });
  }
  return out;
}

/** Aantal open rekeningen met iets van vorige gasten (open sinds gisteren of lijnen van vóór de groep). */
export function previousGuestChecks(data: TableGroupsData | null | undefined): number {
  return [...checkWarnings(data).values()].filter((w) => w.stale || w.prevLines > 0).length;
}

/** Tafels met een actieve tafelgroep (ook zonder open rekening), voor "Tafel vrijgeven". */
export function activeGroupTables(data: TableGroupsData | null | undefined): Set<string> {
  return new Set((data?.tables ?? []).filter((r) => r.group && r.table_id).map((r) => r.table_id as string));
}

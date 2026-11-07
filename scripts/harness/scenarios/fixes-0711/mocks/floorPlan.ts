/* eslint-disable @typescript-eslint/no-explicit-any -- harnas-mock */
// FIXES-0711 — nep-zaalplan: één ruimte, twee tafels. Schrijfacties worden gelogd in window.__writes.
import { useSyncExternalStore } from 'react';
const writes = ((window as unknown as { __writes?: string[] }).__writes ??= []);
const area = { id: 'a1', name: 'Binnen', sort: 0, grid_w: 40, grid_h: 24, is_active: true };
const table = (id: string, label: string, x: number, kind = 'table') => ({ id, area_id: 'a1', label, kind, shape: 'square', seats: 4, w: 2, h: 2, x, y: 2, rotation: 0, is_active: true, qr_token: `tok-${id}` });
let data = { areas: [area], tables: [table('t1', '1', 2), table('t2', '2', 6)], markers: [] as unknown[] };
const subs = new Set<() => void>();
const emit = () => { data = { ...data }; subs.forEach((f) => f()); };
const sub = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
export function useFloorPlan() { const d = useSyncExternalStore(sub, () => data); return { data: d, isLoading: false }; }
export function useHasFloorPlan() { return { hasFloorPlan: true, isLoading: false }; }
const mut = (name: string, fn: (a: any) => unknown) => ({ isPending: false, mutateAsync: async (a: any) => { writes.push(`${name} ${JSON.stringify(a)}`); const r = fn(a); emit(); return r; } });
let n = 10;
export function useFloorPlanMutations() {
  return {
    insertItems: mut('insertItems', (a) => (a.tables ?? []).map((t: any) => { const id = `t${n++}`; data.tables.push({ ...table(id, t.label, t.x), ...t, id, area_id: a.areaId }); return id; })),
    updateTable: mut('updateTable', (a) => { data.tables = data.tables.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)); }),
    updateMarker: mut('updateMarker', () => {}),
    deleteMarker: mut('deleteMarker', () => {}),
    deactivateTable: mut('deactivateTable', (id) => { data.tables = data.tables.filter((t) => t.id !== id); }),
    createArea: mut('createArea', () => 'a2'), updateArea: mut('updateArea', () => {}), deactivateArea: mut('deactivateArea', () => {}),
    renewToken: mut('renewToken', () => {}),
  };
}
export const floorPlanKey = (t?: string) => ['floor-plan', t];

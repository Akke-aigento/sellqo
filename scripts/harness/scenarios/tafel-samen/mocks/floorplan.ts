// TAFEL-SAMEN-1 — Café De Wissel: zaal met tafels 1–9 (tafel 8 = de rekening van gisteren).
import { areas } from './data';
const tables = Array.from({ length: 9 }, (_, i) => ({ id: `tb${i + 1}`, area_id: 'a1', label: String(i + 1), kind: 'table', shape: 'square', seats: 4, x: 1 + (i % 3) * 5, y: 1 + Math.floor(i / 3) * 4, w: 3, h: 3, rotation: 0, is_active: true }));
export const floorPlanKey = (id?: string) => ['floor-plan', id] as const;
export function useFloorPlan() { return { data: { areas: areas.slice(0, 1), tables, markers: [] }, isLoading: false }; }
export function useHasFloorPlan() { return { hasFloorPlan: true, isLoading: false }; }
export function useFloorPlanMutations() { return {}; }

import { areas } from './data';
export const floorPlanKey = (id?: string) => ['floor-plan', id] as const;
export function useFloorPlan() { return { data: { areas, tables: [], markers: [] }, isLoading: false }; }
export function useHasFloorPlan() { return { hasFloorPlan: true, isLoading: false }; }
export function useFloorPlanMutations() { return {}; }

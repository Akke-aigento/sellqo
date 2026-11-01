import data from '../../kassa-home/data.json';
export const floorPlanKey = (id?: string) => ['floor-plan', id] as const;
export function useFloorPlan() { return { data: { areas: data.areas, tables: data.tables, markers: data.markers }, isLoading: false }; }
export function useHasFloorPlan() { return { hasFloorPlan: true, isLoading: false }; }
const mut = { mutate: () => {}, mutateAsync: async () => ({}), isPending: false };
export function useFloorPlanMutations() { return new Proxy({}, { get: () => mut }); }

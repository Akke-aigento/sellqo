export type StationKind = 'kitchen' | 'bar' | 'other';
export interface PrepStation { id: string; name: string; kind: StationKind; sort: number; is_default: boolean }
const data = { stations: [
  { id: 's-bar', name: 'Bar', kind: 'bar' as const, sort: 0, is_default: true },
  { id: 's-keuken', name: 'Keuken', kind: 'kitchen' as const, sort: 1, is_default: false },
], routes: [] };
export function usePrepStations() { return { data }; }

// FOOD-1 — openingsuren voor afhalen en leveren, zoals storefront-api ze leest:
// { pickup: { "1": [["17:00","22:00"]], ... }, local_delivery: {...} }  (0 = zondag).
export type ServiceType = 'pickup' | 'local_delivery';
export type Week = Record<string, [string, string][]>;
export type Hours = Record<ServiceType, Week>;

export const DAYS = [
  { key: '1', label: 'Maandag' }, { key: '2', label: 'Dinsdag' }, { key: '3', label: 'Woensdag' },
  { key: '4', label: 'Donderdag' }, { key: '5', label: 'Vrijdag' }, { key: '6', label: 'Zaterdag' }, { key: '0', label: 'Zondag' },
];

export const emptyHours = (): Hours => ({ pickup: {}, local_delivery: {} });

const isRange = (r: unknown): r is [string, string] => Array.isArray(r) && r.length === 2 && r.every((x) => typeof x === 'string');

export function parseHours(raw: unknown): Hours {
  const out = emptyHours();
  if (!raw || typeof raw !== 'object') return out;
  for (const t of ['pickup', 'local_delivery'] as ServiceType[]) {
    const week = (raw as Record<string, unknown>)[t];
    if (!week || typeof week !== 'object') continue;
    for (const [d, ranges] of Object.entries(week as Record<string, unknown>)) {
      if (Array.isArray(ranges)) out[t][d] = ranges.filter(isRange);
    }
  }
  return out;
}

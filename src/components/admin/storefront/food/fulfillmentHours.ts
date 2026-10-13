// FOOD-1 — openingsuren voor afhalen en leveren, zoals storefront-api ze leest:
// { pickup: { "1": [["17:00","22:00"]], ... }, local_delivery: {...} }  (0 = zondag).
export type ServiceType = 'pickup' | 'local_delivery';
export type Week = Record<string, [string, string][]>;
export type Hours = Record<ServiceType, Week>;

export const DAYS = [
  { key: '1', labelKey: 'admin.storefront.food.day_1' }, { key: '2', labelKey: 'admin.storefront.food.day_2' }, { key: '3', labelKey: 'admin.storefront.food.day_3' },
  { key: '4', labelKey: 'admin.storefront.food.day_4' }, { key: '5', labelKey: 'admin.storefront.food.day_5' }, { key: '6', labelKey: 'admin.storefront.food.day_6' }, { key: '0', labelKey: 'admin.storefront.food.day_0' },
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

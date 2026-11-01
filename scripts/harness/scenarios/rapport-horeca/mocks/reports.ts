// RAPPORT-HORECA-1 — nep-Z-archief en nep-analyse.
const data = (n: number) => ({
  from: '', to: '', sales: { count: 40 + n, total_cents: 182040 + n * 1000, vat_cents: 26900, net_cents: 155140, discount_cents: 450 },
  vats: [{ rate: 21, gross_cents: 98000, vat_cents: 17008, net_cents: 80992 }, { rate: 12, gross_cents: 84040, vat_cents: 9004, net_cents: 75036 }],
  payments: [{ method: 'card', cents: 140040 }, { method: 'cash', cents: 42000 }], rounding_cents: -2, tips: [{ method: 'card', cents: 3150 }],
  cash: { in_cents: 15000, out_cents: 0, count: 1 }, voided: { count: 1, total_cents: 650 }, corrections: { count: 2, total_cents: -900 },
  staff: [{ staff_id: 's1', name: 'Lien', count: 25, total_cents: 110000, tips_cents: 2000 }], shifts: [], drawer_opens: 0, open_checks: 0,
});
const archive = [5, 4, 3, 2, 1].map((n) => ({ id: `z${n}`, kind: 'Z', report_no: 100 + n, booking_date: `2026-10-2${n}`, period_start: `2026-10-2${n}T04:00:00Z`, period_end: `2026-10-2${n + 1}T04:00:00Z`, data: data(n) }));
const analysis = {
  from: '', to: '', from_day: '2026-10-01', to_day: '2026-10-31',
  totals: { revenue_cents: 912345, tickets: 412, checks: 300, checks_revenue_cents: 780000, guests: 820, guests_revenue_cents: 700000, tips_cents: 15400 },
  products: [
    { key: 'p1', name: 'Pils 25cl', qty: 640, cents: 192000 }, { key: 'p2', name: 'Spaghetti bolognese', qty: 120, cents: 168000 },
    { key: 'p3', name: 'Croque monsieur met een heel lange naam die moet afbreken', qty: 90, cents: 103500 }, { key: 'p4', name: 'Cola', qty: 210, cents: 63000 },
    { key: 'p5', name: 'Koffie', qty: 300, cents: 81000 }, { key: 'p6', name: 'Huiswijn rood', qty: 80, cents: 52000 },
  ],
  hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => ({ hour, count: 10 + (hour % 5) * 6, cents: (hour === 15 ? 4000 : 20000 + (hour % 7) * 15000) })),
  days: [],
  staff: [
    { staff_id: 's1', name: 'Lien', count: 210, cents: 480000, tips_cents: 9000 }, { staff_id: 's2', name: 'Bart', count: 180, cents: 400000, tips_cents: 6400 },
    { staff_id: null, name: null, count: 22, cents: 32345, tips_cents: 0 },
  ],
};
export function useZArchive() { return { data: archive, isLoading: false, isError: false }; }
export function useHorecaAnalysis() { return { data: analysis, isLoading: false, isError: false, error: null }; }

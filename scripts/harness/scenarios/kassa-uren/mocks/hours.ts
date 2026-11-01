// PERSONEEL-2 — nep-urenrapport voor de huidige week (relatief aan nu), met een open shift,
// een correctie, een toegevoegde en een geschrapte shift en fooien.
import { addDays, format, startOfISOWeek } from 'date-fns';
const monday = startOfISOWeek(new Date());
const at = (day: number, h: number, m = 0) => { const d = addDays(monday, day); d.setHours(h, m, 0, 0); return d.toISOString(); };
const bd = (day: number) => format(addDays(monday, day), 'yyyy-MM-dd');
const staff = [
  { id: 's1', name: 'Lien', employee_no: 1, role: 'waiter', is_active: true },
  { id: 's2', name: 'Bart Vandenbroucke', employee_no: 2, role: 'bartender', is_active: true },
  { id: 's3', name: 'Sofie', employee_no: 3, role: 'kitchen', is_active: true },
];
const sh = (id: string, staff_id: string, day: number, h1: number, h2: number | null, extra: Record<string, unknown> = {}) => ({
  id, staff_id, source: 'kassa', clock_in_at: at(day, h1), clock_out_at: h2 === null ? null : at(day, h2), original_in: at(day, h1),
  original_out: h2 === null ? null : at(day, h2), voided: false, corrected: false, reason: null, corrected_at: null, business_day: bd(day), ...extra,
});
const report = {
  from: '', to: '', now: new Date().toISOString(), staff,
  shifts: [
    sh('a', 's1', 0, 11, 15), sh('b', 's1', 0, 17, 23), sh('c', 's2', 0, 16, 23, { corrected: true, reason: 'vergeten uit te klokken', original_out: null }),
    sh('d', 's3', 0, 10, 14), { ...sh('e', 's2', 0, 9, 10), voided: true }, { ...sh('f', 's3', 0, 15, 22), source: 'manual', original_in: null, original_out: null, corrected: true },
    sh('g', 's1', 0, 18, null),
  ],
  tips: [{ day: bd(0), cents: 4750 }],
};
export function useKassaHours() {
  return {
    report: { data: report, isLoading: false, isError: false },
    correct: { isPending: false, mutateAsync: async () => 'ok' },
  };
}
export type ShiftCorrection = unknown;

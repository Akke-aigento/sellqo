// Drie bezette tafels (één vraagt de rekening), één rekening op naam, één aan de toog.
const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const line = (name: string, cents: number, qty = 1, state = 'sent') => ({ id: crypto.randomUUID(), seq: 1, product_id: null, variant_id: null, name, department_id: 'd', department_name: 'Dranken', vat_label: 'A', vat_rate: 21, unit_price_cents: cents, qty, addons: [], note: null, course: null, station_id: null, state, round_id: null, neg_reason: null, corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: ago(5), open_qty: qty });
const check = (p: Record<string, unknown>) => ({ id: crypto.randomUUID(), table_id: null, name: null, status: 'open', guests: null, opened_at: ago(20), bill_requested_at: null, reference: 'r', version: 1, next_grouping_id: 1, lines: [], ...p });
const checks = [
  check({ table_id: 't-B1', opened_at: ago(95), guests: 2, lines: [line('Duvel', 450, 4), line('Kaasblokjes', 650)] }),
  check({ table_id: 't-B2', opened_at: ago(12), lines: [line('Cola', 300, 2)] }),
  check({ table_id: 't-B3', opened_at: ago(48), bill_requested_at: ago(2), guests: 4, lines: [line('Spaghetti bolognese', 1650, 4), line('Huiswijn', 2600)] }),
  check({ name: 'Jan (verjaardag)', opened_at: ago(30), lines: [line('Cava', 3200)] }),
  check({ kind: 'counter', opened_at: ago(1), lines: [line('Koffie', 280, 1, 'draft')] }),
];
export const LIVE_POLL_MS = 10_000;
export function useLiveChecks() { return { checks, isLoading: false, error: null, polledAt: now }; }

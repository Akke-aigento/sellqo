// Harnas KASSA-RECHTEN-1 / KASSA-UX-6: de kassa voor een OBER (Tom, geen verantwoordelijke) in Café De Wissel.
// Tafel 4 heeft een verstuurde ronde (Pils, Kriek, bittergarnituur); nieuwe acties blijven lokaal (optimistisch).
import { useEffect, useMemo, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { KassaSessionProvider, useKassaSession } from '@/kassa/app/session';
import { KassaHome } from '@/kassa/app/screens/KassaHome';
import { HorecaStore, type Transport } from '@/kassa/app/horeca/store';
import type { Check, CheckLine } from '@/kassa/app/horeca/types';

const now = Date.now();
const line = (i: number, product: string, name: string, cents: number, qty: number): CheckLine => ({
  id: `l${i}`, seq: i, product_id: product, variant_id: null, name, department_id: 'd', department_name: 'Dranken', vat_label: 'A', vat_rate: 21,
  unit_price_cents: cents, qty, addons: [], note: null, course: null, station_id: null, state: 'sent', round_id: 'r1', neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: new Date(now - 14 * 60_000).toISOString(), open_qty: qty,
});
const checks: Check[] = [{
  id: 'c1', table_id: 't-4', name: null, status: 'open', guests: 4, opened_at: new Date(now - 40 * 60_000).toISOString(), bill_requested_at: null,
  reference: 'c1', version: 1, next_grouping_id: 1,
  lines: [line(1, 'p-spec-0', 'Donker abdijbier', 450, 4), line(2, 'p-spec-2', 'Kriek', 420, 2), line(3, 'p-bit-0', 'Bittergarnituur (8 st.)', 750, 1)],
}];
const transport: Transport = { apply: () => new Promise(() => {}), snapshot: async () => ({ version: 1, checks }), version: async () => 1 };
const store = new HorecaStore('t1', 'dev1', transport, 1e9);
const runtime = { device: { tenantId: 't1', deviceUuid: 'dev1', terminalRowId: 'k1' }, fiscal: { mode: 'off' }, isFiscal: false } as never;

// eslint-disable-next-line react-refresh/only-export-components -- harnas-ingang, geen HMR nodig
function Home() {
  const { staff, signIn } = useKassaSession();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(rerender), []);
  useEffect(() => { localStorage.clear(); localStorage.setItem('sq_kassa_mode', 'zaal'); void store.refresh(); signIn({ id: 's-tom', display_name: 'Tom', role: 'waiter', employee_no: 3, avatar_color: '#6366F1' }, null); }, [signIn]);
  const alerts = useMemo(() => ({ sound: true, setSound: () => {}, wake: true, setWake: () => {}, wakeActive: true }), []);
  if (!staff) return null;
  return <KassaHome runtime={runtime} store={store} alerts={alerts} terminalName="Kassa 1" onForgetDevice={() => {}} />;
}
const qc = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><KassaSessionProvider idleMs={0}><Home /><Toaster /></KassaSessionProvider></QueryClientProvider>,
);

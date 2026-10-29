// Harnas: de kassa na de PIN (KassaHome) met het zaalplan en de kaart van Café De Wissel (demo-bar).
// Echte HorecaStore met een nep-transport: twee open tafels; nieuwe acties blijven lokaal (optimistisch).
import { useEffect, useMemo, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { KassaSessionProvider, useKassaSession } from '@/kassa/app/session';
import { KassaHome } from '@/kassa/app/screens/KassaHome';
import { HorecaStore, type Transport } from '@/kassa/app/horeca/store';
import type { Check, CheckLine } from '@/kassa/app/horeca/types';
import data from './data.json';

const now = Date.now();
const line = (i: number, name: string, cents: number, qty: number, state: CheckLine['state'] = 'sent'): CheckLine => ({
  id: `l${i}`, seq: i, product_id: null, variant_id: null, name, department_id: 'd', department_name: 'Dranken', vat_label: 'A', vat_rate: 21,
  unit_price_cents: cents, qty, addons: [], note: null, course: null, station_id: null, state, round_id: null, neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: new Date(now - 14 * 60_000).toISOString(), open_qty: qty,
});
const check = (id: string, table: string, lines: CheckLine[], bill = false): Check => ({
  id, table_id: table, name: null, status: 'open', guests: null, opened_at: new Date(now - 40 * 60_000).toISOString(), bill_requested_at: bill ? new Date().toISOString() : null,
  reference: id, version: 1, next_grouping_id: 1, lines,
});
const checks: Check[] = [
  check('c1', 't-4', [line(1, 'Pils', 280, 4), line(2, 'Kriek', 420, 2), line(3, 'Bittergarnituur (8 st.)', 750, 1)]),
  check('c2', 't-Ter-2', [line(4, 'Aperol spritz', 950, 2)], true),
  check('c3', 't-B2', [line(5, 'Wit bier', 340, 1)]),
];
const transport: Transport = {
  apply: () => new Promise(() => {}),
  snapshot: async () => ({ version: 1, checks }),
  version: async () => 1,
  requests: async () => [],
};
const store = new HorecaStore('t1', 'dev1', transport, 1e9);
const runtime = { device: { tenantId: 't1', deviceUuid: 'dev1', terminalRowId: 'k1' }, fiscal: { mode: 'off' }, isFiscal: false } as never;

// eslint-disable-next-line react-refresh/only-export-components -- harnas-ingang, geen HMR nodig
function Home() {
  const { staff, signIn } = useKassaSession();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(rerender), []);
  useEffect(() => { localStorage.clear(); void store.refresh(); signIn({ id: 's1', display_name: 'Sofie', role: 'manager', employee_no: 2, avatar_color: '#10B981' }, null); }, [signIn]);
  const alerts = useMemo(() => ({ sound: true, setSound: () => {}, wake: true, setWake: () => {}, wakeActive: true }), []);
  if (!staff) return null;
  return <KassaHome runtime={runtime} store={store} alerts={alerts} terminalName="Kassa 1" onForgetDevice={() => {}} />;
}
const qc = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><KassaSessionProvider idleMs={0}><Home /><Toaster /></KassaSessionProvider></QueryClientProvider>,
);
(window as unknown as { __data: unknown }).__data = data;

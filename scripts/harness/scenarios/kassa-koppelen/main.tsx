// KASSA-ACCOUNT-1 — koppelscherm op het toestel, "geen kassatoestel"/"ontkoppeld", en beheer per kassa
// (Toestel koppelen met code + QR + aftelling, gekoppelde toestellen, Ontkoppelen).
// Scherm via ?screen=pair|owner|revoked|admin.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { PairDevice } from '@/kassa/app/screens/PairDevice';
import { NotADevice } from '@/kassa/app/screens/NotADevice';
import { KassaTerminalDevices } from '@/components/admin/pos/KassaTerminalDevices';
import type { KassaDevice, KassaDeviceAccount } from '@/hooks/useKassaDevices';
import { H } from './mocks/h';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const beat = (id: string, m: number, v = 'sellqo-kassa-0.21.0'): KassaDevice => ({ device_id: id, terminal_id: 't1', sw_version: v, fiscal_mode: 'off', queue_count: 0, outbox_count: 0, pending_pays: 0, online: true, last_seen_at: ago(m) });

// eslint-disable-next-line react-refresh/only-export-components -- harnas-ingang
function Admin() {
  const [accounts, setAccounts] = useState<KassaDeviceAccount[]>([
    { user_id: 'u1', tenant_id: 'tn', terminal_id: 't1', device_uuid: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Kassa 1 · iPad toog', paired_at: ago(60 * 24 * 3) },
  ]);
  (window as unknown as { __pairNow: () => void }).__pairNow = () =>
    setAccounts((a) => [{ user_id: 'u2', tenant_id: 'tn', terminal_id: 't1', device_uuid: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Kassa 1', paired_at: new Date().toISOString() }, ...a]);
  const beats = [beat('aaaaaaaa-0000-4000-8000-000000000001', 2), beat('oud-toestel-1', 60 * 5, 'sellqo-kassa-0.20.0')];
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-lg font-semibold">Kassa 1</p>
        <KassaTerminalDevices tenantId="tn" terminal={{ id: 't1', name: 'Kassa 1' }} accounts={accounts} beats={beats} canManage />
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-lg font-semibold">Terras (personeel)</p>
        <KassaTerminalDevices tenantId="tn" terminal={{ id: 't2', name: 'Terras' }} accounts={accounts} beats={beats} canManage={false} />
      </div>
    </div>
  );
}

const screen = H.screen === 'admin' ? <Admin />
  : H.screen === 'owner' ? <NotADevice variant="owner" onSignOut={() => { (window as unknown as { __signedOut: boolean }).__signedOut = true; }} />
  : H.screen === 'revoked' ? <NotADevice variant="revoked" onSignOut={() => {}} />
  : <PairDevice />;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    {screen}
    <Toaster />
  </QueryClientProvider>,
);

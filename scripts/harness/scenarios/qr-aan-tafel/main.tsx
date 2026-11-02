// QR-MODULES-1 — "QR aan tafel" (QrModeSettings) en Kassa › Betalen (HorecaPaySettings) per variant (?v=…).
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { QrModeSettings } from '@/components/admin/storefront/food/QrModeSettings';
import { HorecaPaySettings } from '@/components/admin/pos/HorecaPaySettings';
import { V } from './mocks/h';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter>
      <div className="max-w-5xl p-4">{V === 'kassa' ? <div className="max-w-3xl"><HorecaPaySettings /></div> : <QrModeSettings />}</div>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

// HORECA-NU-1/2 — het Nu-paneel bovenaan Vandaag (beheer) en ⋯ › Nu op de kassa.
// ?screen=beheer|kassa &role=… &v=rustig|druk &lang=nl|en (zie mocks/h.ts).
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import i18n from '@/i18n';
import { NowPanel } from '@/components/horeca/now/NowPanel';
import { NowScreen } from '@/kassa/app/screens/NowScreen';
import type { ActionCtx } from '@/kassa/app/horeca/actions';
import { H } from './mocks/h';

void i18n.changeLanguage(H.lang);
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const owner = H.role === 'owner' || H.role === 'manager';
const ctx = { staffId: 'k9', staffName: 'Lien', staffRole: owner ? H.role : 'waiter', staffToken: owner ? 'a'.repeat(64) : null,
  runtime: { device: { tenantId: 't1', deviceUuid: 'd1' } } } as unknown as ActionCtx;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={['/admin']}>
      {H.screen === 'kassa'
        ? <div className="min-h-screen bg-background"><div className="border-b px-3 py-2 text-lg font-bold">Nu</div><NowScreen ctx={ctx} /></div>
        : <div className="mx-auto w-full max-w-6xl p-2 md:p-4"><NowPanel nowMs={Date.now()} /></div>}
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

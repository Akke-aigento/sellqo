// TAFEL-SAMEN-1 — Zaal › Live met de waarschuwingen en "Tafel vrijgeven", de tegel "Vorige gasten" op het
// Nu-paneel en Instellingen › QR aan tafel met gedeeld mandje en inactiviteit.
// ?screen=zaal|nu|qr &lang=nl|en &groups=off (databank zonder de nieuwe functie: geen waarschuwingen, geen fout).
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import i18n from '@/i18n';
import { NowPanel } from '@/components/horeca/now/NowPanel';
import { LiveFloorOverview } from '@/components/admin/horeca/LiveFloorOverview';
import { QrModeSettings } from '@/components/admin/storefront/food/QrModeSettings';
import { H } from './mocks/h';

const screen = new URLSearchParams(location.search).get('screen') ?? 'zaal';
void i18n.changeLanguage(H.lang);
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={['/admin']}>
      <div className="mx-auto w-full max-w-6xl p-2 md:p-4">
        {screen === 'nu' ? <NowPanel nowMs={Date.now()} /> : screen === 'qr' ? <QrModeSettings /> : <LiveFloorOverview onEditPlan={() => {}} />}
      </div>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

// KASSA-MOBIEL-1 — het keukenscherm (/admin/keuken): de kop mag op 390 px niets buiten beeld duwen.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import KitchenPage from '@/pages/admin/Kitchen';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter><KitchenPage /></MemoryRouter>
    <Toaster />
  </QueryClientProvider>,
);

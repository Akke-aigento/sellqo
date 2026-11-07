// FIXES-0711 — ?screen=floor: zaalplan, tafel (vaste klant) toevoegen met "Klaar"; ?screen=sidebar: zijbalk
// zonder "Personaliseer menu" en Mijn onderbalk met de ECHTE zichtbaarheidsregels (useNavItemVisibility).
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { MyBottomNavSettings } from '@/components/admin/settings/MyBottomNavSettings';
import { FloorPlanEditor } from '@/components/admin/floorplan/FloorPlanEditor';
import { H } from '../mijn-zaak/mocks/h';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={['/admin']}>
      {H.screen === 'floor' ? (
        <div className="p-4"><FloorPlanEditor /></div>
      ) : (
        <SidebarProvider>
          <AdminSidebar />
          <main className="flex-1 p-4"><SidebarTrigger aria-label="menu" /><MyBottomNavSettings /></main>
        </SidebarProvider>
      )}
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

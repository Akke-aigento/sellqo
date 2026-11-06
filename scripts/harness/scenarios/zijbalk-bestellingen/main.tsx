// ZIJBALK-BESTELLINGEN-1 — de horeca-only-zijbalk en de gsm-onderbalk, met en zonder online afhalen/leveren.
// ?online=on|off|orders (zie mocks/supabase.ts), ?tracks=horeca|horeca,webshop.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMobileBottomNav } from '@/components/admin/AdminMobileBottomNav';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={['/admin']}>
      <SidebarProvider>
        <AdminSidebar />
        <main className="p-4"><SidebarTrigger aria-label="menu" /></main>
        <AdminMobileBottomNav />
      </SidebarProvider>
    </MemoryRouter>
  </QueryClientProvider>,
);

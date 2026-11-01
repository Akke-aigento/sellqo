// HORECA-ZIJBALK-1 / KAART-MARGE-1 — zijbalk, Zaal (live + bewerken), Bestellen, Instellingen › Horeca, Kaart.
// Scherm via ?screen=sidebar|zaal|zaal-edit|bestellen|settings|kaart (&tracks=horeca,webshop &role=staff).
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { lazy, Suspense } from 'react';
import { H } from './mocks/h';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const entry: Record<string, string> = {
  sidebar: '/admin', zaal: '/admin/zaal', 'zaal-edit': '/admin/zaal?tab=bewerken', bestellen: `/admin/bestellen${H.tab ? `?tab=${H.tab}` : ''}`,
  settings: '/admin/settings', kaart: '/admin/bestellen',
};
// Enkel het gevraagde scherm laden (alles samen is te zwaar voor een koude vite-start).
const Sidebar = lazy(async () => {
  const [{ SidebarProvider, SidebarTrigger }, { AdminSidebar }] = await Promise.all([import('@/components/ui/sidebar'), import('@/components/admin/AdminSidebar')]);
  return { default: () => <SidebarProvider><AdminSidebar /><main className="p-4"><SidebarTrigger aria-label="menu" /></main></SidebarProvider> };
});
const Floor = lazy(() => import('@/pages/admin/Floor'));
const Hub = lazy(() => import('@/pages/admin/OrderingHub'));
const Settings = lazy(async () => { const m = await import('@/components/admin/settings/HorecaSettingsHub'); return { default: () => <div className="max-w-3xl p-4"><m.HorecaSettingsHub /></div> }; });
const Kaart = lazy(async () => { const m = await import('@/components/admin/horeca/kaart/KaartManager'); return { default: () => <div className="p-4"><m.KaartManager /></div> }; });
const Screen = { sidebar: Sidebar, zaal: Floor, 'zaal-edit': Floor, bestellen: Hub, settings: Settings, kaart: Kaart }[H.screen] ?? Sidebar;
const screen = <Suspense fallback={null}><Screen /></Suspense>;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={[entry[H.screen] ?? '/admin']}>
      <Routes><Route path="*" element={screen} /></Routes>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

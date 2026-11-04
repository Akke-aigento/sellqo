// HORECA-INSTELLINGEN-1 — Mijn zaak (checklist, groepen met tabs, zoekbalk), Personeel, Reservaties,
// de horeca-only-zijbalk, de kop met ⌘K, en als bewijs een webshopzaak (zijbalk + Instellingen).
// Scherm via ?screen=sidebar|settings|staff|reservations|header (&tracks=… &role=… &path=<url>).
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { lazy, Suspense } from 'react';
import { H } from './mocks/h';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const entry: Record<string, string> = {
  sidebar: '/admin', settings: '/admin/settings', staff: '/admin/personeel', reservations: '/admin/reservaties', header: '/admin/settings',
};
const Sidebar = lazy(async () => {
  const [{ SidebarProvider, SidebarTrigger }, { AdminSidebar }] = await Promise.all([import('@/components/ui/sidebar'), import('@/components/admin/AdminSidebar')]);
  return { default: () => <SidebarProvider><AdminSidebar /><main className="p-4"><SidebarTrigger aria-label="menu" /></main></SidebarProvider> };
});
const Settings = lazy(async () => { const m = await import('@/pages/admin/Settings'); return { default: () => <main className="p-4 sm:p-6"><m.default /></main> }; });
const Staff = lazy(() => import('@/pages/admin/Staff'));
const Reservations = lazy(() => import('@/pages/admin/Reservations'));
const Header = lazy(async () => {
  const [{ SidebarProvider }, { AdminHeader }] = await Promise.all([import('@/components/ui/sidebar'), import('@/components/admin/AdminHeader')]);
  return { default: () => <SidebarProvider><div className="w-full"><AdminHeader /><Where /></div></SidebarProvider> };
});
/** Toont de huidige route, zodat de stappen een doorverwijzing kunnen nakijken. */
function Where() { const l = useLocation(); return <p data-testid="where" className="p-4 text-xs text-muted-foreground">{l.pathname}{l.search}{l.hash}</p>; }
const own: Record<string, string> = { staff: '/admin/personeel', reservations: '/admin/reservaties' };
const Screen = { sidebar: Sidebar, settings: Settings, staff: Staff, reservations: Reservations, header: Header }[H.screen] ?? Settings;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={[H.path ?? entry[H.screen] ?? '/admin/settings']}>
      {/* 1b: Personeel en Reservaties sturen een combinatiezaak door; elders enkel de route tonen (geen lus). */}
      {own[H.screen] ? (
        <Routes>
          <Route path={own[H.screen]} element={<Suspense fallback={null}><Screen /><Where /></Suspense>} />
          <Route path="*" element={<Where />} />
        </Routes>
      ) : (
        <Routes><Route path="*" element={<Suspense fallback={null}><Screen />{H.screen !== 'header' ? <Where /> : null}</Suspense>} /></Routes>
      )}
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

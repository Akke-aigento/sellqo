// UREN-1 / WEBSITE-HORECA-1 — Instellingen › Bedrijfsgegevens met de openingsuren, afhalen/leveren en online
// reserveren ("Zelfde als openingsuren" / "Eigen uren"), de horeca-zijbalk met Website, de Website-pagina als
// horecazaak, de sectiekiezer in Aanpassen en Instellingen › Horeca.
// Scherm via ?screen=sidebar|bedrijf|afhalen|reservaties|website|aanpassen|hub (&tracks=horeca,webshop &role=viewer &hours=empty).
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { lazy, Suspense } from 'react';
import { H } from './mocks/h';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const entry: Record<string, string> = {
  sidebar: '/admin', bedrijf: '/admin/settings?section=company', afhalen: '/admin/bestellen?tab=webshop', reservaties: '/admin/bestellen?tab=reservaties',
  website: '/admin/storefront', aanpassen: '/admin/storefront/aanpassen', hub: '/admin/settings?section=horeca',
};
const wrap = (C: () => JSX.Element) => ({ default: () => <div className="mx-auto max-w-4xl p-4"><C /></div> });
const Sidebar = lazy(async () => {
  const [{ SidebarProvider, SidebarTrigger }, { AdminSidebar }] = await Promise.all([import('@/components/ui/sidebar'), import('@/components/admin/AdminSidebar')]);
  return { default: () => <SidebarProvider><AdminSidebar /><main className="p-4"><SidebarTrigger aria-label="menu" /></main></SidebarProvider> };
});
const Bedrijf = lazy(async () => wrap((await import('@/components/admin/settings/BusinessSettings')).BusinessSettings));
const Afhalen = lazy(async () => wrap((await import('@/components/admin/storefront/food/FulfillmentSettings')).FulfillmentSettings));
const Reservaties = lazy(async () => wrap((await import('@/components/admin/horeca/OnlineReservationsCard')).OnlineReservationsCard));
const Website = lazy(() => import('@/pages/admin/Storefront'));
const Aanpassen = lazy(() => import('@/pages/admin/StorefrontCustomize'));
const Hub = lazy(async () => wrap((await import('@/components/admin/settings/HorecaSettingsHub')).HorecaSettingsHub));
const Screen = { sidebar: Sidebar, bedrijf: Bedrijf, afhalen: Afhalen, reservaties: Reservaties, website: Website, aanpassen: Aanpassen, hub: Hub }[H.screen] ?? Bedrijf;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={[entry[H.screen] ?? '/admin']}>
      <Routes><Route path="*" element={<Suspense fallback={null}><Screen /></Suspense>} /></Routes>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

// KASSA-0/PERSONEEL-1 — ingang van het tweede app-target "SellQo Kassa" (app.sellqo.kassa).
// Zelfde i18n, stijl en foutvanger als de admin; de schermen zitten in KassaApp.
// KASSA-MOBIEL-1: geen AuthProvider (beheer) meer: de kassa heeft een eigen aanmelding (KassaAuthProvider in
// KassaApp, kassa-client met eigen storageKey). In deze app is er geen beheer.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/index.css';
import '@/i18n';
import { installGlobalErrorHandlers } from '@/lib/clientErrors';
import { RootErrorBoundary } from '@/components/AppErrorBoundary';
import { KassaApp } from './KassaApp';
import { Toaster } from '@/components/ui/sonner';

installGlobalErrorHandlers();
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } } });

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <KassaApp />
      {/* MELDING-1: meldingen in beeld (QR-bestelling, klare bon, online betaling) ook in de aparte Kassa-app. */}
      <Toaster />
    </QueryClientProvider>
  </RootErrorBoundary>,
);

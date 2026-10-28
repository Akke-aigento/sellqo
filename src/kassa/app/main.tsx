// KASSA-0/PERSONEEL-1 — ingang van het tweede app-target "SellQo Kassa" (app.sellqo.kassa).
// Zelfde i18n, stijl, foutvanger en Supabase-sessie als de admin; de schermen zitten in KassaApp.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/index.css';
import '@/i18n';
import { installGlobalErrorHandlers } from '@/lib/clientErrors';
import { RootErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/hooks/useAuth';
import { KassaApp } from './KassaApp';
import { Toaster } from '@/components/ui/sonner';

installGlobalErrorHandlers();
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } } });

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <KassaApp />
        {/* MELDING-1: meldingen in beeld (QR-bestelling, klare bon, online betaling) ook in de aparte Kassa-app. */}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </RootErrorBoundary>,
);

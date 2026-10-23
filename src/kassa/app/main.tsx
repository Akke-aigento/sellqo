// KASSA-0 — ingang van het tweede app-target "SellQo Kassa" (app.sellqo.kassa).
// Skelet: bewijst dat het target bouwt en de fiscale kern laadt. De echte schermen komen
// in TAFEL-1/TAFEL-2. Zelfde i18n, stijl en foutvanger als de admin.
import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import { installGlobalErrorHandlers } from '@/lib/clientErrors';
import { RootErrorBoundary } from '@/components/AppErrorBoundary';
import { KassaHome } from './KassaHome';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <KassaHome />
  </RootErrorBoundary>,
);

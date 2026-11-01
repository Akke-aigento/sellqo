// Harnas GANGEN-1: Bestellen › Posten › kaart "Gangen aan tafel".
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { CoursesSettings } from '@/components/admin/horeca/CoursesSettings';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}><div className="p-4"><div className="max-w-3xl"><CoursesSettings /></div></div><Toaster /></QueryClientProvider>,
);

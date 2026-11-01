import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { KassaHoursCard } from '@/components/admin/pos/KassaHoursCard';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/admin/pos?tab=personeel']}>
    <div style={{ padding: 16 }}><KassaHoursCard /></div>
    <Toaster />
  </MemoryRouter>,
);

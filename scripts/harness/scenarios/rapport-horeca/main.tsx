import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { HorecaReportsTab } from '@/components/admin/reports/HorecaReportsTab';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/admin/reports?tab=horeca']}>
    <div style={{ padding: 16 }}><HorecaReportsTab from={new Date(2026, 9, 1)} to={new Date(2026, 9, 31)} /></div>
    <Toaster />
  </MemoryRouter>,
);

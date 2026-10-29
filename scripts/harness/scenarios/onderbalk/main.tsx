import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MyBottomNavSettings } from '@/components/admin/settings/MyBottomNavSettings';
import { AdminMobileBottomNav } from '@/components/admin/AdminMobileBottomNav';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/admin']}>
    <div style={{ padding: 16, paddingBottom: 100 }}><MyBottomNavSettings /></div>
    <AdminMobileBottomNav />
    <Toaster />
  </MemoryRouter>,
);

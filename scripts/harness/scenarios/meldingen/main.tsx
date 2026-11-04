// HORECA-STAAT-1 — meldingen (toasts) in het beheer: wegswipen (boven, links, rechts), sluitkruisje,
// duur (4 s, fouten 8 s), bovenaan en nooit over de onderbalk. Gebruikt de echte Toaster uit
// @/components/ui/sonner en `toast` rechtstreeks uit 'sonner', zoals de 220+ bestaande aanroepen.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { AdminMobileBottomNav } from '@/components/admin/AdminMobileBottomNav';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/admin']}>
    <div style={{ padding: 16, paddingTop: 140, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => toast.success('Keuken gepauzeerd tot 21:53')}>Succes</button>
      <button type="button" onClick={() => toast.error('Dat lukte niet. Probeer opnieuw.')}>Fout</button>
      <button type="button" onClick={() => toast('Gewone melding')}>Gewoon</button>
    </div>
    <AdminMobileBottomNav />
    <Toaster />
  </MemoryRouter>,
);

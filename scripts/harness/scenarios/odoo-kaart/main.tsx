// ODOO-HORECA-1 harnas — de Odoo-kaart in vier standen: horecaplan zonder Odoo (upgrade naar Horeca Big),
// webshopplan zonder Odoo (Pro of Enterprise), met toegang niet verbonden, en verbonden met sync aan.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { OdooAccountingCard } from '@/components/admin/accounting/OdooAccountingCard';
import { CardCtx, type CardState } from './mocks/ctx';

const cards: Array<[string, CardState]> = [
  ['horeca-locked', { access: false, track: 'horeca', configured: false, sync: false }],
  ['webshop-locked', { access: false, track: 'webshop', configured: false, sync: false }],
  ['open', { access: true, track: 'horeca', configured: false, sync: false }],
  ['connected', { access: true, track: 'webshop', configured: true, sync: true }],
];

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="p-4 grid gap-4 md:grid-cols-2 max-w-5xl mx-auto" data-harness="root">
      {cards.map(([k, s]) => (
        <section key={k} data-card={k}>
          <CardCtx.Provider value={s}><OdooAccountingCard tenantId="t1" onOpen={() => {}} /></CardCtx.Provider>
        </section>
      ))}
    </div>
  </MemoryRouter>,
);

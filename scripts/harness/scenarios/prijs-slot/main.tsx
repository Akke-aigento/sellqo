// PRIJS-GATEN-1 harnas — varianten-tab en productraster voor een rol zonder prijsrecht (?role=warehouse,
// standaard) en voor een beheerder (?role=tenant_admin).
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductVariantsTab } from '@/components/admin/products/ProductVariantsTab';
import { ProductGridView } from '@/components/admin/products/grid/ProductGridView';
import type { Product } from '@/types/product';
import { products } from './mocks/data';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter>
      <div className="p-4 space-y-6 max-w-6xl mx-auto" data-harness="root">
        <section data-part="variants"><ProductVariantsTab productId="p1" trackInventory defaultPrice={12} /></section>
        <section data-part="grid" className="h-[420px]"><ProductGridView products={products as unknown as Product[]} /></section>
      </div>
    </MemoryRouter>
  </QueryClientProvider>,
);

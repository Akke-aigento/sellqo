// PRIJS-GATEN-1 harnas — varianten-tab en productraster voor een rol zonder prijsrecht (?role=marketing,
// standaard) en voor een beheerder (?role=tenant_admin).
// Deel 3: warehouse en viewer zien de productpagina alleen-lezen (readOnly zoals ProductForm).
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductVariantsTab } from '@/components/admin/products/ProductVariantsTab';
import { ProductGridView } from '@/components/admin/products/grid/ProductGridView';
import { ProductBulkEditDialog } from '@/components/admin/products/ProductBulkEditDialog';
import type { Product } from '@/types/product';
import { products, readOnly } from './mocks/data';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
// PRIJS-GATEN-2: ?screen=bulk toont enkel de bulkbewerking (een modaal venster).
const screen = new URLSearchParams(location.search).get('screen');
createRoot(document.getElementById('root')!).render(screen === 'bulk' ? (
  <QueryClientProvider client={qc}>
    <ProductBulkEditDialog open onOpenChange={() => {}} selectedCount={2} selectedIds={['p1', 'p2']} onApply={async () => {}} />
  </QueryClientProvider>
) : (
  <QueryClientProvider client={qc}>
    <MemoryRouter>
      <div className="p-4 space-y-6 max-w-6xl mx-auto" data-harness="root">
        <section data-part="variants"><ProductVariantsTab productId="p1" trackInventory defaultPrice={12} readOnly={readOnly} /></section>
        <section data-part="grid" className="h-[420px]"><ProductGridView products={products as unknown as Product[]} /></section>
      </div>
    </MemoryRouter>
  </QueryClientProvider>,
));

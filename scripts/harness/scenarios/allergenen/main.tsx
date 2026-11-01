// Harnas: de allergenen-kaart van de producteditor (ALLERGEEN-VERKLAARD-1) in drie standen:
// niet ingevuld, "bevat geen" en met allergenen (dan is "bevat geen" uitgeschakeld).
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ProductAllergensCard } from '@/components/admin/storefront/food/ProductAllergensCard';

(window as unknown as { __rows: Record<string, unknown> }).__rows = {
  open: { allergens: [], dietary: [], allergens_declared: false },
  geen: { allergens: [], dietary: ['vegan', 'vegetarian'], allergens_declared: true },
  met: { allergens: ['gluten', 'milk'], dietary: [], allergens_declared: true },
};
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <div className="space-y-4 p-3">
      <ProductAllergensCard productId="open" />
      <ProductAllergensCard productId="geen" />
      <ProductAllergensCard productId="met" />
    </div>
    <Toaster />
  </QueryClientProvider>,
);

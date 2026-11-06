// Harnas MENUKAART-PRINT-1: de Kaart met de knop Afdrukken (?screen=kaart) en de afdrukdialoog
// (?screen=dialog). Testkaart: 8 categorieën, 60 gerechten, allergenen, dieetlabels, lange namen.
// Productfoto's zijn webp's die hier op een canvas getekend worden (zo loopt ook het pad
// webp → canvas → jpg van loadPdfImage echt in de browser).
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { KaartManager } from '@/components/admin/horeca/kaart/KaartManager';
import { MenuPrintDialog } from '@/components/admin/horeca/kaart/MenuPrintDialog';

function photo(hue: number): string {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 1200); grad.addColorStop(0, `hsl(${hue},45%,35%)`); grad.addColorStop(1, `hsl(${hue + 20},40%,18%)`);
  g.fillStyle = grad; g.fillRect(0, 0, 900, 1200);
  g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(450, 520, 330, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 3 ? '#c4302b' : '#3a7d3a'; g.beginPath(); g.arc(450 + Math.cos(i) * (40 + i * 5), 520 + Math.sin(i * 1.7) * (30 + i * 5), 22, 0, Math.PI * 2); g.fill(); }
  return c.toDataURL('image/webp', 0.9);
}

const CATS = ['Voorgerechten', 'Soepen', 'Salades', 'Pasta & risotto', 'Hoofdgerechten vlees', 'Vis & zeevruchten', 'Desserts', 'Warme dranken'];
const NAMES = ['Carpaccio van rund met rucola, parmezaan en truffelmayonaise', 'Kroketten van Noordzeegarnalen', 'Burrata met tomaat', 'Vitello tonnato', 'Gamba’s in look', 'Scampi diabolique',
  'Tomatensoep met balletjes', 'Pompoensoep', 'Vissoep op Oostendse wijze met rouille en croutons', 'Caesarsalade', 'Salade geitenkaas', 'Salade niçoise', 'Poké bowl met zalm',
  'Spaghetti bolognese', 'Penne arrabbiata', 'Tagliatelle scampi', 'Risotto met eekhoorntjesbrood', 'Lasagne', 'Linguine vongole', 'Gnocchi met salieboter',
  'Steak met frietjes en bearnaise', 'Stoofvlees met frietjes', 'Vol-au-vent', 'Konijn met pruimen', 'Spareribs', 'Entrecote Black Angus 300 g met groenten van het seizoen', 'Kipfilet champignonsaus', 'Varkenshaasje',
  'Tongrolletjes', 'Zalmfilet met dillesaus', 'Mosselen natuur', 'Mosselen look', 'Kabeljauw mosterdsaus', 'Zeetong meunière', 'Gegrilde scampi',
  'Dame blanche', 'Crème brûlée', 'Tiramisu', 'Moelleux van chocolade', 'Sabayon', 'Coupe Brésilienne', 'Pannenkoeken', 'Café glacé', 'Kaasplank',
  'Koffie', 'Espresso', 'Cappuccino', 'Latte macchiato', 'Thee', 'Verse muntthee', 'Warme chocolademelk', 'Irish coffee', 'Italian coffee', 'French coffee', 'Chai latte', 'Koffie verkeerd', 'Dubbele espresso', 'Ristretto', 'Flat white', 'Gemberthee'];
const PER = [6, 3, 4, 7, 8, 7, 9, 16];
const AL = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];
const photos = [20, 200, 340, 90].map(photo);
const products: Record<string, unknown>[] = [];
let k = 0;
PER.forEach((n, ci) => { for (let j = 0; j < n; j++, k++) products.push({
  id: `p${k}`, name: NAMES[k], price: 3.2 + ((k * 7.35) % 31), category_id: `c${ci}`, is_active: true, hide_from_storefront: false,
  channels: ['online', 'table', 'menu', 'pos'], menu_position: j, sold_out_until: null, vat_rate_id: null, takeaway_vat_rate_id: null, cost_price: null,
  short_description: k % 3 === 0 ? 'Huisgemaakt met verse producten van lokale boeren.' : null, description: null,
  allergens: AL.filter((_, a) => (k + a) % 5 === 0).slice(0, 4), dietary: k % 7 === 0 ? ['vegetarian'] : [], allergens_declared: true,
  featured_image: k < 4 ? photos[k] : null, images: null,
}); });
(window as unknown as { __db: Record<string, unknown[]> }).__db = {
  categories: CATS.map((name, i) => ({ id: `c${i}`, name, sort_order: i, is_active: true, hide_from_storefront: false, default_vat_rate_id: null, default_takeaway_vat_rate_id: null })),
  products,
  menu_print_settings: [],
  vat_rates: [],
};

const screen = new URLSearchParams(location.search).get('screen') ?? 'kaart';
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>
      <div className="p-3 sm:p-6">
        {screen === 'dialog' ? <MenuPrintDialog open onOpenChange={() => {}} canWrite /> : <KaartManager />}
      </div>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);

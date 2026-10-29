import data from '../data.json';
export type { CatalogProduct, Catalog } from '@/kassa/app/horeca/useCatalog';
export function useCatalog() { return { data: { products: data.products, categories: data.categories } }; }
// Verkochte lijnen voor "Populair": pils, cola, wit bier, kriek, aperol, bittergarnituur, croque.
const sold: [string, number][] = [['p-tap-1', 40], ['p-fris-0', 22], ['p-tap-0', 18], ['p-spec-2', 12], ['p-cock-0', 9], ['p-bit-0', 7], ['p-hon-1', 6], ['p-fris-5', 5]];
export function usePopularLines() { return { data: sold.map(([product_id, qty]) => ({ product_id, qty })) }; }

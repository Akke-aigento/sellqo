// PRODUCT-FORM-1 — welke onderdelen het productformulier toont. Eén bron, zodat de pagina
// afhangt van het soort product en de sporen (webshop / horeca / events) van de winkel,
// in plaats van alles aan iedereen te tonen.
//
// Regels (beslissing Akke 30-10):
// - "Voeding of drank" is een schakelaar per product (products.is_food), voor elke winkel:
//   ook een webshop kan wijn of koekjes verkopen. Enkel bij fysieke producten en bundels.
// - Allergenen en dieetlabels: enkel bij voeding.
// - Extra's, kanalen, keukenstation en btw bij meenemen: horeca-spoor én voeding.
// - Verzending, marketplaces (bol.com e.a.) en advertenties: enkel met het webshop-spoor.
// - Producttypes per spoor; het huidige type blijft altijd zichtbaar (bestaande data).
// Niets hier verbergt data: een verborgen veld wordt niet gewist en blijft bewaard.
import type { ProductType } from '@/types/product';

export interface ProductFormContext {
  webshop: boolean;
  horeca: boolean;
  events: boolean;
  productType: ProductType;
  isFood: boolean;
}

const ALL_TYPES: ProductType[] = ['physical', 'digital', 'service', 'subscription', 'bundle', 'gift_card', 'ticket'];

export function productTypesFor(c: Pick<ProductFormContext, 'webshop' | 'horeca' | 'events' | 'productType'>): ProductType[] {
  const allowed = new Set<ProductType>();
  if (c.webshop) ['physical', 'digital', 'service', 'subscription', 'bundle', 'gift_card'].forEach((t) => allowed.add(t as ProductType));
  if (c.horeca) ['physical', 'bundle', 'gift_card'].forEach((t) => allowed.add(t as ProductType));
  if (c.events) ['ticket', 'physical'].forEach((t) => allowed.add(t as ProductType));
  if (allowed.size === 0) allowed.add('physical');
  allowed.add(c.productType);
  return ALL_TYPES.filter((t) => allowed.has(t));
}

export function foodEligible(productType: ProductType): boolean {
  return productType === 'physical' || productType === 'bundle';
}

/** Standaardwaarde van "Voeding of drank" bij een nieuw product: aan zodra de winkel horeca doet. */
export function defaultIsFood(c: Pick<ProductFormContext, 'horeca'>): boolean {
  return c.horeca;
}

export function productFormSections(c: ProductFormContext) {
  const food = foodEligible(c.productType) && c.isFood;
  return {
    foodToggle: foodEligible(c.productType),
    allergens: food,
    horecaCards: c.horeca && food,
    shipping: c.webshop,
    marketplacesTab: c.webshop,
    adsTab: c.webshop,
    productTypes: productTypesFor(c),
  };
}

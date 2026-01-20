import type { CartItem, AppliedDiscount } from '../types';
import { isPromotionActive, calculateDiscountValue } from '../validators';

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  applies_to: string;
  product_ids: string[] | null;
  category_ids: string[] | null;
  minimum_order_amount: number | null;
  maximum_discount_amount: number | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;
  first_order_only: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

export interface DiscountCodeResult {
  discount: AppliedDiscount | null;
  error: string | null;
}

export function validateAndCalculateDiscountCode(
  items: CartItem[],
  subtotal: number,
  discountCode: DiscountCode | null,
  customerUsageCount: number = 0,
  isFirstOrder: boolean = false
): DiscountCodeResult {
  if (!discountCode) {
    return { discount: null, error: null };
  }

  // Check if active and within date range
  if (!isPromotionActive(discountCode.is_active, discountCode.valid_from, discountCode.valid_until)) {
    return { discount: null, error: 'Deze kortingscode is niet meer geldig' };
  }

  // Check usage limit
  if (discountCode.usage_limit && discountCode.usage_count >= discountCode.usage_limit) {
    return { discount: null, error: 'Deze kortingscode is niet meer beschikbaar' };
  }

  // Check per-customer usage limit
  if (discountCode.usage_limit_per_customer && customerUsageCount >= discountCode.usage_limit_per_customer) {
    return { discount: null, error: 'Je hebt deze kortingscode al gebruikt' };
  }

  // Check first order only
  if (discountCode.first_order_only && !isFirstOrder) {
    return { discount: null, error: 'Deze kortingscode is alleen geldig voor je eerste bestelling' };
  }

  // Check minimum order amount
  if (discountCode.minimum_order_amount && subtotal < discountCode.minimum_order_amount) {
    return { 
      discount: null, 
      error: `Minimaal bestelbedrag: €${discountCode.minimum_order_amount.toFixed(2)}` 
    };
  }

  // Calculate discount base based on applies_to
  let discountBase = 0;

  switch (discountCode.applies_to) {
    case 'all':
    case 'order':
      discountBase = subtotal;
      break;

    case 'specific_products':
      if (discountCode.product_ids && discountCode.product_ids.length > 0) {
        const eligibleItems = items.filter(item => 
          discountCode.product_ids!.includes(item.product_id)
        );
        discountBase = eligibleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      }
      break;

    case 'category':
    case 'specific_categories':
      if (discountCode.category_ids && discountCode.category_ids.length > 0) {
        const eligibleItems = items.filter(item => 
          item.category_id && discountCode.category_ids!.includes(item.category_id)
        );
        discountBase = eligibleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      }
      break;

    default:
      discountBase = subtotal;
  }

  if (discountBase === 0) {
    return { 
      discount: null, 
      error: 'Geen producten in je winkelwagen komen in aanmerking voor deze kortingscode' 
    };
  }

  // Calculate the discount
  const discountAmount = calculateDiscountValue(
    discountBase,
    discountCode.discount_type,
    discountCode.discount_value,
    discountCode.maximum_discount_amount
  );

  if (discountAmount <= 0) {
    return { discount: null, error: 'Kortingscode geeft geen korting op huidige producten' };
  }

  return {
    discount: {
      type: 'discount_code',
      name: discountCode.code,
      value: discountAmount,
      source_id: discountCode.id,
      description: discountCode.discount_type === 'percentage'
        ? `${discountCode.discount_value}% korting`
        : `€${discountCode.discount_value.toFixed(2)} korting`,
    },
    error: null,
  };
}

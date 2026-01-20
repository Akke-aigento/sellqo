import type { CartItem, AppliedDiscount } from '../types';
import type { AutomaticDiscount } from '@/types/promotions';
import { isPromotionActive, checkSchedule, calculateDiscountValue } from '../validators';

export interface AutoDiscountResult {
  discounts: AppliedDiscount[];
  totalDiscount: number;
  freeShipping: boolean;
  freeShippingReason?: string;
  freeProductId?: string;
}

export function calculateAutoDiscounts(
  items: CartItem[],
  subtotal: number,
  autoDiscounts: AutomaticDiscount[]
): AutoDiscountResult {
  const result: AutoDiscountResult = {
    discounts: [],
    totalDiscount: 0,
    freeShipping: false,
  };

  // Sort by priority (lower number = higher priority)
  const activeDiscounts = autoDiscounts
    .filter(ad => isPromotionActive(ad.is_active, ad.valid_from, ad.valid_until))
    .filter(ad => checkSchedule(ad.schedule))
    .sort((a, b) => a.priority - b.priority);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartProductIds = items.map(item => item.product_id);

  for (const discount of activeDiscounts) {
    let triggered = false;

    // Check trigger conditions
    switch (discount.trigger_type) {
      case 'cart_total':
        triggered = discount.trigger_value ? subtotal >= discount.trigger_value : false;
        break;
      
      case 'item_count':
        triggered = discount.trigger_value ? totalQuantity >= discount.trigger_value : false;
        break;
      
      case 'first_order':
        // This would require customer context - skip for now
        // TODO: Implement first order check
        triggered = false;
        break;
      
      case 'specific_products':
        if (discount.trigger_product_ids && discount.trigger_product_ids.length > 0) {
          triggered = discount.trigger_product_ids.some(id => cartProductIds.includes(id));
        }
        break;
      
      case 'schedule':
        // Schedule is already checked above, so if we're here it's valid
        triggered = true;
        break;
      
      default:
        triggered = true;
    }

    if (!triggered) continue;

    // Apply discount based on type
    if (discount.discount_type === 'free_shipping') {
      result.freeShipping = true;
      result.freeShippingReason = discount.name;
      result.discounts.push({
        type: 'automatic',
        name: discount.name,
        value: 0, // Shipping discount calculated separately
        source_id: discount.id,
        description: 'Gratis verzending',
      });
      continue;
    }

    if (discount.discount_type === 'free_product' && discount.free_product_id) {
      result.freeProductId = discount.free_product_id;
      result.discounts.push({
        type: 'automatic',
        name: discount.name,
        value: 0, // Gift value tracked separately
        source_id: discount.id,
        description: 'Gratis product',
      });
      continue;
    }

    // Calculate discount amount based on applies_to
    let discountBase = 0;

    if (discount.applies_to === 'cart' || discount.applies_to === 'all') {
      discountBase = subtotal;
    } else if (discount.applies_to === 'specific_products' && discount.product_ids) {
      const eligibleItems = items.filter(item => discount.product_ids!.includes(item.product_id));
      discountBase = eligibleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    } else {
      discountBase = subtotal;
    }

    const discountAmount = calculateDiscountValue(
      discountBase,
      discount.discount_type,
      discount.discount_value || 0,
      discount.max_discount_amount
    );

    if (discountAmount > 0) {
      result.discounts.push({
        type: 'automatic',
        name: discount.name,
        value: discountAmount,
        source_id: discount.id,
        description: discount.description || discount.name,
      });
      result.totalDiscount += discountAmount;
    }
  }

  return result;
}

import type { CartItem, AppliedDiscount } from '../types';
import type { BogoPromotion } from '@/types/promotions';
import { isPromotionActive, calculateDiscountValue } from '../validators';

export interface BogoResult {
  discounts: AppliedDiscount[];
  totalDiscount: number;
}

export function calculateBogoPromotions(
  items: CartItem[],
  bogoPromotions: BogoPromotion[]
): BogoResult {
  const result: BogoResult = {
    discounts: [],
    totalDiscount: 0,
  };

  const activePromotions = bogoPromotions.filter(promo =>
    isPromotionActive(promo.is_active, promo.valid_from, promo.valid_until)
  );

  for (const promo of activePromotions) {
    // Find items that qualify for "buy" condition
    const buyItems = items.filter(item => {
      if (promo.buy_product_ids && promo.buy_product_ids.length > 0) {
        return promo.buy_product_ids.includes(item.product_id);
      }
      if (promo.buy_category_ids && promo.buy_category_ids.length > 0 && item.category_id) {
        return promo.buy_category_ids.includes(item.category_id);
      }
      // If no specific products/categories, any item qualifies
      return promo.promotion_type === 'buy_x_get_y_same';
    });

    const buyQuantity = buyItems.reduce((sum, item) => sum + item.quantity, 0);
    
    // Check if buy condition is met
    if (buyQuantity < promo.buy_quantity) continue;

    // Calculate how many times the promotion can be applied
    let timesApplicable = Math.floor(buyQuantity / promo.buy_quantity);
    
    // Apply max uses per order limit
    if (promo.max_uses_per_order && timesApplicable > promo.max_uses_per_order) {
      timesApplicable = promo.max_uses_per_order;
    }

    if (timesApplicable === 0) continue;

    // Find "get" items
    let getItems: CartItem[] = [];
    
    if (promo.promotion_type === 'buy_x_get_y_same') {
      // Same items qualify for the discount
      getItems = buyItems;
    } else {
      // Different items for "get"
      getItems = items.filter(item => {
        if (promo.get_product_ids && promo.get_product_ids.length > 0) {
          return promo.get_product_ids.includes(item.product_id);
        }
        if (promo.get_category_ids && promo.get_category_ids.length > 0 && item.category_id) {
          return promo.get_category_ids.includes(item.category_id);
        }
        return false;
      });
    }

    if (getItems.length === 0) continue;

    // Sort by price ascending (discount cheapest items first, or most expensive based on strategy)
    const sortedGetItems = [...getItems].sort((a, b) => a.price - b.price);

    // Calculate total "get" quantity that gets discounted
    const totalGetQuantity = timesApplicable * promo.get_quantity;
    let remainingGetQuantity = totalGetQuantity;
    let discountTotal = 0;

    for (const item of sortedGetItems) {
      if (remainingGetQuantity <= 0) break;

      const discountableQty = Math.min(item.quantity, remainingGetQuantity);
      remainingGetQuantity -= discountableQty;

      const itemTotal = item.price * discountableQty;
      
      let itemDiscount: number;
      if (promo.discount_type === 'free' || promo.discount_value === 100) {
        itemDiscount = itemTotal;
      } else {
        itemDiscount = calculateDiscountValue(itemTotal, promo.discount_type, promo.discount_value);
      }

      discountTotal += itemDiscount;
    }

    if (discountTotal > 0) {
      const promoLabel = promo.promotion_type === 'buy_x_get_y_same' 
        ? `Koop ${promo.buy_quantity}, krijg ${promo.get_quantity} ${promo.discount_type === 'free' ? 'gratis' : 'met korting'}`
        : promo.name;

      result.discounts.push({
        type: 'bogo',
        name: promo.name,
        value: discountTotal,
        source_id: promo.id,
        description: promoLabel,
      });
      result.totalDiscount += discountTotal;
    }
  }

  return result;
}

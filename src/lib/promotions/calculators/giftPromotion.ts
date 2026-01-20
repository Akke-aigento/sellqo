import type { CartItem, CartGift } from '../types';
import type { GiftPromotion } from '@/types/promotions';
import { isPromotionActive } from '../validators';

export interface GiftResult {
  gifts: CartGift[];
}

export function calculateGiftPromotions(
  items: CartItem[],
  subtotal: number,
  giftPromotions: GiftPromotion[]
): GiftResult {
  const result: GiftResult = {
    gifts: [],
  };

  const activePromotions = giftPromotions.filter(promo =>
    isPromotionActive(promo.is_active, promo.valid_from, promo.valid_until)
  );

  const cartProductIds = items.map(item => item.product_id);
  const cartCategoryIds = items.map(item => item.category_id).filter(Boolean) as string[];
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  for (const promo of activePromotions) {
    // Check stock limit
    if (promo.stock_limit && promo.stock_used >= promo.stock_limit) continue;

    let triggered = false;

    switch (promo.trigger_type) {
      case 'cart_total':
      case 'order_total':
        triggered = promo.trigger_value ? subtotal >= promo.trigger_value : false;
        break;

      case 'quantity':
      case 'product_quantity':
        triggered = promo.trigger_value ? totalQuantity >= promo.trigger_value : false;
        break;

      case 'specific_products':
        if (promo.trigger_product_ids && promo.trigger_product_ids.length > 0) {
          triggered = promo.trigger_product_ids.some(id => cartProductIds.includes(id));
        }
        break;

      case 'category':
        if (promo.trigger_category_ids && promo.trigger_category_ids.length > 0) {
          triggered = promo.trigger_category_ids.some(id => cartCategoryIds.includes(id));
        }
        break;

      default:
        triggered = true;
    }

    if (!triggered) continue;

    // Calculate gift quantity
    let giftQty = promo.gift_quantity;

    // Apply max per order limit
    if (promo.max_per_order && giftQty > promo.max_per_order) {
      giftQty = promo.max_per_order;
    }

    // Apply remaining stock limit
    if (promo.stock_limit) {
      const remaining = promo.stock_limit - promo.stock_used;
      giftQty = Math.min(giftQty, remaining);
    }

    if (giftQty <= 0) continue;

    // Check if this gift can stack with others
    if (!promo.is_stackable && result.gifts.length > 0) continue;

    result.gifts.push({
      product_id: promo.gift_product_id,
      product_name: promo.gift_product?.name || 'Cadeau',
      quantity: giftQty,
      promotion_id: promo.id,
      promotion_name: promo.name,
      product_image: promo.gift_product?.image_url,
    });
  }

  return result;
}

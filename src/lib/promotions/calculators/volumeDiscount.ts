import type { CartItem, AppliedDiscount, ItemDiscount } from '../types';
import type { VolumeDiscount } from '@/types/promotions';
import { isPromotionActive, calculateDiscountValue } from '../validators';

export interface VolumeDiscountResult {
  discounts: AppliedDiscount[];
  itemDiscounts: Map<number, number>;
  totalDiscount: number;
}

export function calculateVolumeDiscounts(
  items: CartItem[],
  volumeDiscounts: VolumeDiscount[]
): VolumeDiscountResult {
  const result: VolumeDiscountResult = {
    discounts: [],
    itemDiscounts: new Map(),
    totalDiscount: 0,
  };

  const activeDiscounts = volumeDiscounts.filter(vd => 
    isPromotionActive(vd.is_active, vd.valid_from, vd.valid_until)
  );

  for (const discount of activeDiscounts) {
    const eligibleItems = items.filter((item, index) => {
      // Check if item matches the discount scope
      if (discount.applies_to === 'all') return true;
      if (discount.applies_to === 'product' && discount.product_ids?.includes(item.product_id)) return true;
      if (discount.applies_to === 'category' && item.category_id && discount.category_ids?.includes(item.category_id)) return true;
      return false;
    });

    if (eligibleItems.length === 0) continue;

    // Calculate total quantity of eligible items
    const totalQuantity = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);

    // Find applicable tier
    const tiers = discount.tiers || [];
    const applicableTier = tiers
      .filter(tier => totalQuantity >= tier.min_quantity)
      .filter(tier => !tier.max_quantity || totalQuantity <= tier.max_quantity)
      .sort((a, b) => b.min_quantity - a.min_quantity)[0];

    if (!applicableTier) continue;

    // Calculate discount for each eligible item
    let discountTotal = 0;
    items.forEach((item, index) => {
      const isEligible = eligibleItems.includes(item);
      if (!isEligible) return;

      const itemTotal = item.price * item.quantity;
      const itemDiscount = calculateDiscountValue(
        itemTotal,
        applicableTier.discount_type,
        applicableTier.discount_value
      );

      const existing = result.itemDiscounts.get(index) || 0;
      result.itemDiscounts.set(index, existing + itemDiscount);
      discountTotal += itemDiscount;
    });

    if (discountTotal > 0) {
      result.discounts.push({
        type: 'volume',
        name: discount.name,
        value: discountTotal,
        source_id: discount.id,
        description: `Staffelkorting: ${applicableTier.discount_value}${applicableTier.discount_type === 'percentage' ? '%' : '€'} korting`,
      });
      result.totalDiscount += discountTotal;
    }
  }

  return result;
}

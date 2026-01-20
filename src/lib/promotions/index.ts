// Main promotion calculation engine
export * from './types';
export * from './validators';
export { calculateVolumeDiscounts } from './calculators/volumeDiscount';
export { calculateBogoPromotions } from './calculators/bogoPromotion';
export { calculateBundleDiscounts } from './calculators/bundleDiscount';
export { calculateAutoDiscounts } from './calculators/autoDiscount';
export { calculateGiftPromotions } from './calculators/giftPromotion';
export { calculateCustomerGroupDiscounts } from './calculators/customerGroupDiscount';
export { calculateLoyaltyBenefits } from './calculators/loyaltyDiscount';
export { validateAndCalculateDiscountCode } from './calculators/discountCode';

import type { CartItem, CartCalculationResult, AppliedDiscount, StackingConfig } from './types';
import type { 
  VolumeDiscount, 
  BogoPromotion, 
  ProductBundle, 
  AutomaticDiscount, 
  GiftPromotion,
  CustomerGroup,
  CustomerGroupProductPrice,
  LoyaltyProgram,
  CustomerLoyalty,
  DiscountStackingRule 
} from '@/types/promotions';

import { calculateVolumeDiscounts } from './calculators/volumeDiscount';
import { calculateBogoPromotions } from './calculators/bogoPromotion';
import { calculateBundleDiscounts } from './calculators/bundleDiscount';
import { calculateAutoDiscounts } from './calculators/autoDiscount';
import { calculateGiftPromotions } from './calculators/giftPromotion';
import { calculateCustomerGroupDiscounts } from './calculators/customerGroupDiscount';
import { calculateLoyaltyBenefits } from './calculators/loyaltyDiscount';
import { validateAndCalculateDiscountCode, type DiscountCode } from './calculators/discountCode';

export interface PromotionData {
  volumeDiscounts: VolumeDiscount[];
  bogoPromotions: BogoPromotion[];
  bundles: ProductBundle[];
  autoDiscounts: AutomaticDiscount[];
  giftPromotions: GiftPromotion[];
  customerGroups: CustomerGroup[];
  customerGroupProductPrices: CustomerGroupProductPrice[];
  loyaltyProgram: LoyaltyProgram | null;
  customerLoyalty: CustomerLoyalty | null;
  discountCode: DiscountCode | null;
  stackingRules: DiscountStackingRule[];
}

export interface CalculateCartOptions {
  items: CartItem[];
  promotions: PromotionData;
  pointsToRedeem?: number;
  customerUsageCount?: number;
  isFirstOrder?: boolean;
}

function getStackingConfig(rules: DiscountStackingRule[]): StackingConfig {
  const activeRule = rules.find(r => r.is_active);
  
  if (!activeRule) {
    // Default: allow all stacking
    return {
      allow_stacking: true,
      max_stack_count: 10,
      max_total_discount_percent: 100,
      priority_order: ['discount_code', 'automatic', 'volume', 'bundle', 'bogo', 'customer_group', 'loyalty'],
    };
  }

  return {
    allow_stacking: activeRule.rule_type !== 'no_stacking',
    max_stack_count: activeRule.max_stack_count || 10,
    max_total_discount_percent: activeRule.max_total_discount_percent || 100,
    priority_order: activeRule.priority_order || ['discount_code', 'automatic', 'volume', 'bundle', 'bogo', 'customer_group', 'loyalty'],
  };
}

export function calculateCartPromotions(options: CalculateCartOptions): CartCalculationResult {
  const { items, promotions, pointsToRedeem = 0, customerUsageCount = 0, isFirstOrder = false } = options;

  const originalSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const result: CartCalculationResult = {
    original_subtotal: originalSubtotal,
    discounted_subtotal: originalSubtotal,
    total_discount: 0,
    applied_discounts: [],
    item_discounts: [],
    gifts: [],
    loyalty_points_earned: 0,
    loyalty_points_redeemed: 0,
    loyalty_discount: 0,
    free_shipping: false,
    applied_gift_cards: [],
    gift_card_total: 0,
    final_amount_due: originalSubtotal,
  };

  if (items.length === 0) return result;

  const stackingConfig = getStackingConfig(promotions.stackingRules);
  const allDiscounts: AppliedDiscount[] = [];

  // 1. Calculate all discount types
  const volumeResult = calculateVolumeDiscounts(items, promotions.volumeDiscounts);
  allDiscounts.push(...volumeResult.discounts);

  const bogoResult = calculateBogoPromotions(items, promotions.bogoPromotions);
  allDiscounts.push(...bogoResult.discounts);

  const bundleResult = calculateBundleDiscounts(items, promotions.bundles);
  allDiscounts.push(...bundleResult.discounts);

  const autoResult = calculateAutoDiscounts(items, originalSubtotal, promotions.autoDiscounts);
  allDiscounts.push(...autoResult.discounts);
  if (autoResult.freeShipping) {
    result.free_shipping = true;
    result.free_shipping_reason = autoResult.freeShippingReason;
  }

  const groupResult = calculateCustomerGroupDiscounts(
    items, 
    originalSubtotal, 
    promotions.customerGroups,
    promotions.customerGroupProductPrices
  );
  allDiscounts.push(...groupResult.discounts);

  const codeResult = validateAndCalculateDiscountCode(
    items,
    originalSubtotal,
    promotions.discountCode,
    customerUsageCount,
    isFirstOrder
  );
  if (codeResult.discount) {
    allDiscounts.push(codeResult.discount);
  }

  // 2. Apply stacking rules
  let finalDiscounts: AppliedDiscount[] = [];

  if (!stackingConfig.allow_stacking) {
    // No stacking: take highest value discount only
    const sorted = allDiscounts.sort((a, b) => b.value - a.value);
    if (sorted.length > 0) {
      finalDiscounts = [sorted[0]];
    }
  } else {
    // Apply priority ordering
    const prioritized = allDiscounts.sort((a, b) => {
      const aIndex = stackingConfig.priority_order.indexOf(a.type);
      const bIndex = stackingConfig.priority_order.indexOf(b.type);
      return aIndex - bIndex;
    });

    // Apply max stack count
    finalDiscounts = prioritized.slice(0, stackingConfig.max_stack_count);

    // Check max total discount percentage
    const maxDiscountAmount = originalSubtotal * (stackingConfig.max_total_discount_percent / 100);
    let runningTotal = 0;
    
    finalDiscounts = finalDiscounts.filter(d => {
      if (runningTotal + d.value <= maxDiscountAmount) {
        runningTotal += d.value;
        return true;
      }
      return false;
    });
  }

  result.applied_discounts = finalDiscounts;
  result.total_discount = finalDiscounts.reduce((sum, d) => sum + d.value, 0);

  // 3. Calculate loyalty
  const loyaltyResult = calculateLoyaltyBenefits(
    originalSubtotal - result.total_discount,
    pointsToRedeem,
    promotions.loyaltyProgram,
    promotions.customerLoyalty
  );

  result.loyalty_points_earned = loyaltyResult.pointsEarned;
  result.loyalty_points_redeemed = loyaltyResult.pointsRedeemed;
  result.loyalty_discount = loyaltyResult.loyaltyDiscount;

  if (loyaltyResult.discount) {
    result.applied_discounts.push(loyaltyResult.discount);
    result.total_discount += loyaltyResult.loyaltyDiscount;
  }

  // 4. Calculate gifts
  const giftResult = calculateGiftPromotions(items, originalSubtotal, promotions.giftPromotions);
  result.gifts = giftResult.gifts;

  // 5. Final calculation
  result.discounted_subtotal = Math.max(0, originalSubtotal - result.total_discount);

  return result;
}

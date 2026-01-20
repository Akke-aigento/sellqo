import type { CartItem, AppliedDiscount } from '../types';
import type { CustomerGroup, CustomerGroupProductPrice } from '@/types/promotions';
import { calculateDiscountValue } from '../validators';

export interface CustomerGroupResult {
  discounts: AppliedDiscount[];
  itemDiscounts: Map<number, number>;
  totalDiscount: number;
}

export function calculateCustomerGroupDiscounts(
  items: CartItem[],
  subtotal: number,
  customerGroups: CustomerGroup[],
  productPrices: CustomerGroupProductPrice[]
): CustomerGroupResult {
  const result: CustomerGroupResult = {
    discounts: [],
    itemDiscounts: new Map(),
    totalDiscount: 0,
  };

  if (customerGroups.length === 0) return result;

  // Sort groups by priority (lower = higher priority)
  const sortedGroups = [...customerGroups]
    .filter(g => g.is_active)
    .sort((a, b) => a.priority - b.priority);

  // Get the highest priority group
  const primaryGroup = sortedGroups[0];
  if (!primaryGroup) return result;

  // First, apply product-specific prices from customer group
  const groupProductPrices = productPrices.filter(
    pp => pp.customer_group_id === primaryGroup.id
  );

  let productSpecificDiscount = 0;

  for (const pp of groupProductPrices) {
    const itemIndex = items.findIndex(item => item.product_id === pp.product_id);
    if (itemIndex === -1) continue;

    const item = items[itemIndex];
    const originalTotal = item.price * item.quantity;
    let discount = 0;

    if (pp.custom_price !== null) {
      // Fixed custom price
      const customTotal = pp.custom_price * item.quantity;
      discount = originalTotal - customTotal;
    } else if (pp.discount_percentage !== null) {
      // Percentage discount on this product
      discount = originalTotal * (pp.discount_percentage / 100);
    }

    if (discount > 0) {
      result.itemDiscounts.set(itemIndex, (result.itemDiscounts.get(itemIndex) || 0) + discount);
      productSpecificDiscount += discount;
    }
  }

  if (productSpecificDiscount > 0) {
    result.discounts.push({
      type: 'customer_group',
      name: `${primaryGroup.name} productprijzen`,
      value: productSpecificDiscount,
      source_id: primaryGroup.id,
      description: `Speciale prijzen voor ${primaryGroup.name}`,
    });
    result.totalDiscount += productSpecificDiscount;
  }

  // Then, apply general group discount if applicable
  if (primaryGroup.discount_type && primaryGroup.discount_value) {
    // Check minimum order amount
    if (primaryGroup.min_order_amount && subtotal < primaryGroup.min_order_amount) {
      return result;
    }

    // Calculate on remaining subtotal (after product-specific discounts)
    const remainingSubtotal = subtotal - productSpecificDiscount;
    
    const generalDiscount = calculateDiscountValue(
      remainingSubtotal,
      primaryGroup.discount_type,
      primaryGroup.discount_value
    );

    if (generalDiscount > 0) {
      result.discounts.push({
        type: 'customer_group',
        name: primaryGroup.name,
        value: generalDiscount,
        source_id: primaryGroup.id,
        description: `Groepskorting: ${primaryGroup.discount_value}${primaryGroup.discount_type === 'percentage' ? '%' : '€'}`,
      });
      result.totalDiscount += generalDiscount;
    }
  }

  return result;
}

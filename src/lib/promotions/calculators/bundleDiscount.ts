import type { CartItem, AppliedDiscount } from '../types';
import type { ProductBundle } from '@/types/promotions';
import { isPromotionActive, calculateDiscountValue } from '../validators';

export interface BundleResult {
  discounts: AppliedDiscount[];
  totalDiscount: number;
}

export function calculateBundleDiscounts(
  items: CartItem[],
  bundles: ProductBundle[]
): BundleResult {
  const result: BundleResult = {
    discounts: [],
    totalDiscount: 0,
  };

  const activeBundles = bundles.filter(bundle =>
    isPromotionActive(bundle.is_active, bundle.valid_from, bundle.valid_until)
  );

  for (const bundle of activeBundles) {
    if (!bundle.products || bundle.products.length === 0) continue;

    if (bundle.bundle_type === 'fixed') {
      // Fixed bundle: all required products must be present
      const requiredProducts = bundle.products.filter(bp => bp.is_required);
      
      // Check if all required products are in cart with sufficient quantity
      let bundleComplete = true;
      let maxBundles = Infinity;
      let bundleOriginalPrice = 0;

      for (const bundleProduct of requiredProducts) {
        const cartItem = items.find(item => item.product_id === bundleProduct.product_id);
        
        if (!cartItem || cartItem.quantity < bundleProduct.quantity) {
          bundleComplete = false;
          break;
        }

        // Calculate how many complete bundles we can make
        const possibleBundles = Math.floor(cartItem.quantity / bundleProduct.quantity);
        maxBundles = Math.min(maxBundles, possibleBundles);

        // Add to bundle price (using cart item price or bundleProduct.product.price)
        const productPrice = bundleProduct.product?.price || cartItem.price;
        bundleOriginalPrice += productPrice * bundleProduct.quantity;
      }

      if (!bundleComplete || maxBundles === 0 || maxBundles === Infinity) continue;

      // Calculate discount per bundle
      let discountPerBundle: number;
      
      if (bundle.discount_type === 'fixed_price') {
        // Fixed price for the bundle
        discountPerBundle = bundleOriginalPrice - bundle.discount_value;
      } else if (bundle.discount_type === 'percentage') {
        discountPerBundle = bundleOriginalPrice * (bundle.discount_value / 100);
      } else {
        // fixed_amount
        discountPerBundle = bundle.discount_value;
      }

      const totalDiscount = discountPerBundle * maxBundles;

      if (totalDiscount > 0) {
        result.discounts.push({
          type: 'bundle',
          name: bundle.name,
          value: totalDiscount,
          source_id: bundle.id,
          description: `Bundel: ${bundle.name}${maxBundles > 1 ? ` (${maxBundles}x)` : ''}`,
        });
        result.totalDiscount += totalDiscount;
      }
    } else if (bundle.bundle_type === 'mix_match') {
      // Mix & Match: count items from bundle products
      const bundleProductIds = bundle.products.map(bp => bp.product_id);
      const matchingItems = items.filter(item => bundleProductIds.includes(item.product_id));
      
      if (matchingItems.length === 0) continue;

      const totalMatchingQty = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Check minimum items requirement
      if (bundle.min_items && totalMatchingQty < bundle.min_items) continue;

      // Calculate items that qualify (up to max_items if set)
      const qualifyingQty = bundle.max_items 
        ? Math.min(totalMatchingQty, bundle.max_items)
        : totalMatchingQty;

      // Calculate total price of qualifying items
      let qualifyingTotal = 0;
      let remaining = qualifyingQty;
      
      for (const item of matchingItems) {
        const useQty = Math.min(item.quantity, remaining);
        qualifyingTotal += item.price * useQty;
        remaining -= useQty;
        if (remaining <= 0) break;
      }

      const discount = calculateDiscountValue(
        qualifyingTotal,
        bundle.discount_type === 'fixed_price' ? 'fixed_amount' : bundle.discount_type,
        bundle.discount_type === 'fixed_price' 
          ? qualifyingTotal - bundle.discount_value 
          : bundle.discount_value
      );

      if (discount > 0) {
        result.discounts.push({
          type: 'bundle',
          name: bundle.name,
          value: discount,
          source_id: bundle.id,
          description: `Mix & Match: ${bundle.name}`,
        });
        result.totalDiscount += discount;
      }
    }
  }

  return result;
}

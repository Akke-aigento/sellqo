import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/context/CartContext';

export interface PromotionDiscount {
  type: string;
  name: string;
  value: number;
  source_id: string;
  description?: string;
}

export interface PromotionGift {
  product_id: string;
  product_name: string;
  quantity: number;
  promotion_id: string;
  promotion_name: string;
  product_image?: string | null;
}

export interface CartPromotionResult {
  original_subtotal: number;
  discounted_subtotal: number;
  total_discount: number;
  applied_discounts: PromotionDiscount[];
  gifts: PromotionGift[];
  free_shipping: boolean;
  free_shipping_reason?: string;
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
}

const EMPTY_RESULT: CartPromotionResult = {
  original_subtotal: 0,
  discounted_subtotal: 0,
  total_discount: 0,
  applied_discounts: [],
  gifts: [],
  free_shipping: false,
  loyalty_points_earned: 0,
  loyalty_points_redeemed: 0,
};

export function useCartPromotions(tenantId?: string) {
  const { items, appliedDiscount } = useCart();
  const [result, setResult] = useState<CartPromotionResult>(EMPTY_RESULT);
  const [isCalculating, setIsCalculating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastPayloadRef = useRef<string>('');

  const calculate = useCallback(async () => {
    if (!tenantId || items.length === 0) {
      setResult(EMPTY_RESULT);
      return;
    }

    const cartItems = items.map(item => ({
      product_id: item.productId,
      product_name: item.name,
      sku: item.sku,
      price: item.price || (item.giftCard as any)?.amount || 0,
      quantity: item.quantity,
    }));

    const payload = JSON.stringify({ items: cartItems, discount_code: appliedDiscount?.code });
    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('storefront-api', {
        body: {
          action: 'calculate_promotions',
          tenant_id: tenantId,
          params: {
            items: cartItems,
            discount_code: appliedDiscount?.code || undefined,
          },
        },
      });

      if (error) {
        console.error('Promotion calculation error:', error);
        return;
      }

      const res = data?.data || data;
      if (res) {
        setResult({
          original_subtotal: res.original_subtotal || 0,
          discounted_subtotal: res.discounted_subtotal || 0,
          total_discount: res.total_discount || 0,
          applied_discounts: res.applied_discounts || [],
          gifts: res.gifts || [],
          free_shipping: res.free_shipping || false,
          free_shipping_reason: res.free_shipping_reason,
          loyalty_points_earned: res.loyalty_points_earned || 0,
          loyalty_points_redeemed: res.loyalty_points_redeemed || 0,
        });
      }
    } catch (err) {
      console.error('Failed to calculate promotions:', err);
    } finally {
      setIsCalculating(false);
    }
  }, [tenantId, items, appliedDiscount?.code]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(calculate, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [calculate]);

  // Total discount from promotions (excluding manual discount code that's already in applied_discounts)
  const autoDiscountTotal = result.applied_discounts
    .filter(d => d.type !== 'discount_code')
    .reduce((sum, d) => sum + d.value, 0);

  return {
    ...result,
    autoDiscountTotal,
    isCalculating,
  };
}

// Cart item structure for promotion calculations
export interface CartItem {
  product_id: string;
  product_name: string;
  sku?: string;
  price: number;
  quantity: number;
  category_id?: string | null;
  image_url?: string | null;
}

// Context for calculating promotions
export interface PromotionContext {
  tenant_id: string;
  customer_id?: string;
  cart_items: CartItem[];
  discount_code?: string;
  loyalty_points_to_redeem?: number;
}

// Individual discount result
export interface AppliedDiscount {
  type: 'discount_code' | 'automatic' | 'volume' | 'bundle' | 'bogo' | 'customer_group' | 'loyalty';
  name: string;
  value: number;
  source_id: string;
  description?: string;
}

// Gift item added to cart
export interface CartGift {
  product_id: string;
  product_name: string;
  quantity: number;
  promotion_id: string;
  promotion_name: string;
  product_image?: string | null;
}

// Item-level discount tracking
export interface ItemDiscount {
  item_index: number;
  product_id: string;
  original_price: number;
  discounted_price: number;
  discount_amount: number;
  applied_promotions: string[];
}

// Complete cart calculation result
export interface CartCalculationResult {
  original_subtotal: number;
  discounted_subtotal: number;
  total_discount: number;
  applied_discounts: AppliedDiscount[];
  item_discounts: ItemDiscount[];
  gifts: CartGift[];
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  loyalty_discount: number;
  free_shipping: boolean;
  free_shipping_reason?: string;
}

// Stacking configuration
export interface StackingConfig {
  allow_stacking: boolean;
  max_stack_count: number;
  max_total_discount_percent: number;
  priority_order: string[];
}

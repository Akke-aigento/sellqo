// Product Bundles
export interface ProductBundle {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  bundle_type: 'fixed' | 'mix_match';
  discount_type: 'percentage' | 'fixed_amount' | 'fixed_price';
  discount_value: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  min_items: number | null;
  max_items: number | null;
  created_at: string;
  updated_at: string;
  products?: BundleProduct[];
}

export interface BundleProduct {
  id: string;
  bundle_id: string;
  product_id: string;
  quantity: number;
  is_required: boolean;
  group_name: string | null;
  sort_order: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

export interface ProductBundleFormData {
  name: string;
  description?: string;
  bundle_type: 'fixed' | 'mix_match';
  discount_type: 'percentage' | 'fixed_amount' | 'fixed_price';
  discount_value: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  min_items?: number;
  max_items?: number;
  products: {
    product_id: string;
    quantity: number;
    is_required: boolean;
    group_name?: string;
  }[];
}

// Volume Discounts
export interface VolumeDiscount {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  applies_to: 'all' | 'category' | 'product';
  product_ids: string[] | null;
  category_ids: string[] | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  tiers?: VolumeDiscountTier[];
}

export interface VolumeDiscountTier {
  id: string;
  volume_discount_id: string;
  min_quantity: number;
  max_quantity: number | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  created_at: string;
}

export interface VolumeDiscountFormData {
  name: string;
  description?: string;
  applies_to: 'all' | 'category' | 'product';
  product_ids?: string[];
  category_ids?: string[];
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  tiers: {
    min_quantity: number;
    max_quantity?: number;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
  }[];
}

// BOGO Promotions
export interface BogoPromotion {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  promotion_type: string;
  buy_quantity: number;
  get_quantity: number;
  buy_product_ids: string[] | null;
  buy_category_ids: string[] | null;
  get_product_ids: string[] | null;
  get_category_ids: string[] | null;
  discount_type: string;
  discount_value: number;
  max_uses_per_order: number | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface BogoPromotionFormData {
  name: string;
  description?: string | null;
  promotion_type: string;
  buy_quantity: number;
  get_quantity: number;
  buy_product_ids?: string[];
  buy_category_ids?: string[];
  get_product_ids?: string[];
  get_category_ids?: string[];
  discount_type: string;
  discount_value: number;
  max_uses_per_order?: number | null;
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

// Customer Groups
export interface CustomerGroup {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount' | null;
  discount_value: number | null;
  min_order_amount: number | null;
  tax_exempt: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface CustomerGroupMember {
  id: string;
  customer_group_id: string;
  customer_id: string;
  joined_at: string;
  expires_at: string | null;
  customer?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
}

export interface CustomerGroupProductPrice {
  id: string;
  customer_group_id: string;
  product_id: string;
  custom_price: number | null;
  discount_percentage: number | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
  };
}

export interface CustomerGroupFormData {
  name: string;
  code: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed_amount';
  discount_value?: number;
  min_order_amount?: number;
  tax_exempt: boolean;
  is_active: boolean;
  priority: number;
}

// Automatic Discounts
export interface AutoDiscountSchedule {
  days?: number[];
  start_time?: string;
  end_time?: string;
}

export interface AutomaticDiscount {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: number | null;
  trigger_product_ids: string[] | null;
  discount_type: string;
  discount_value: number | null;
  free_product_id: string | null;
  applies_to: string;
  product_ids: string[] | null;
  max_discount_amount: number | null;
  schedule: AutoDiscountSchedule | null;
  priority: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomaticDiscountFormData {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_value?: number;
  trigger_product_ids?: string[];
  discount_type: string;
  discount_value?: number;
  free_product_id?: string;
  applies_to: string;
  product_ids?: string[];
  max_discount_amount?: number;
  schedule?: AutoDiscountSchedule;
  priority: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
}

// Gift Promotions
export interface GiftPromotion {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: number | null;
  trigger_product_ids: string[] | null;
  trigger_category_ids: string[] | null;
  gift_product_id: string;
  gift_quantity: number;
  max_per_order: number | null;
  stock_limit: number | null;
  stock_used: number;
  is_stackable: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  gift_product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

export interface GiftPromotionFormData {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_value?: number;
  trigger_product_ids?: string[];
  trigger_category_ids?: string[];
  gift_product_id: string;
  gift_quantity: number;
  max_per_order?: number;
  stock_limit?: number;
  is_stackable: boolean;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
}

// Loyalty System
export interface LoyaltyProgram {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  points_per_euro: number;
  points_value: number;
  min_points_redeem: number;
  max_redemption_percentage: number | null;
  points_expiry_months: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tiers?: LoyaltyTier[];
}

export interface LoyaltyTier {
  id: string;
  loyalty_program_id: string;
  name: string;
  min_points: number;
  points_multiplier: number;
  discount_percentage: number | null;
  benefits: string[] | null;
  created_at: string;
}

export interface CustomerLoyalty {
  id: string;
  customer_id: string;
  loyalty_program_id: string;
  points_balance: number;
  points_earned_total: number;
  points_spent_total: number;
  current_tier_id: string | null;
  joined_at: string;
  last_activity_at: string | null;
  current_tier?: LoyaltyTier;
  customer?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface LoyaltyTransaction {
  id: string;
  customer_loyalty_id: string;
  transaction_type: 'earn' | 'redeem' | 'expire' | 'adjust';
  points: number;
  order_id: string | null;
  description: string | null;
  created_at: string;
}

export interface LoyaltyProgramFormData {
  name: string;
  description?: string | null;
  points_per_euro: number;
  points_value: number;
  min_points_redeem: number;
  max_redemption_percentage?: number;
  points_expiry_months?: number;
  is_active: boolean;
}

export interface LoyaltyTierFormData {
  name: string;
  min_points: number;
  points_multiplier: number;
  discount_percentage?: number;
  benefits?: string[];
}

// Discount Stacking Rules
export interface DiscountStackingRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  rule_type: string;
  discount_types: string[] | null;
  max_stack_count: number | null;
  max_total_discount_percent: number | null;
  priority_order: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StackingRuleFormData {
  name: string;
  description?: string | null;
  rule_type: string;
  discount_types?: string[];
  max_stack_count?: number | null;
  max_total_discount_percent?: number | null;
  priority_order?: string[];
  is_active: boolean;
}

// Cart Discount Calculation Result
export interface AppliedDiscount {
  type: 'discount_code' | 'automatic' | 'volume' | 'bundle' | 'bogo' | 'customer_group' | 'loyalty';
  name: string;
  value: number;
  source_id: string;
}

export interface CartGift {
  product_id: string;
  product_name: string;
  quantity: number;
  promotion_id: string;
  promotion_name: string;
}

export interface CartDiscountResult {
  original_subtotal: number;
  discounted_subtotal: number;
  total_discount: number;
  applied_discounts: AppliedDiscount[];
  gifts: CartGift[];
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
}

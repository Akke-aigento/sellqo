export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';
export type DiscountAppliesTo = 'all' | 'specific_products' | 'specific_categories';

export interface DiscountCode {
  id: string;
  tenant_id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_amount: number | null;
  maximum_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  usage_limit_per_customer: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  applies_to: DiscountAppliesTo;
  product_ids: string[] | null;
  category_ids: string[] | null;
  first_order_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountCodeUsage {
  id: string;
  discount_code_id: string;
  order_id: string | null;
  customer_email: string;
  discount_amount: number;
  created_at: string;
}

export interface DiscountCodeFormData {
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_amount: number | null;
  maximum_discount_amount: number | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  applies_to: DiscountAppliesTo;
  product_ids: string[];
  category_ids: string[];
  first_order_only: boolean;
}

export interface ValidateDiscountCodeResult {
  valid: boolean;
  discount_code?: {
    id: string;
    code: string;
    discount_type: DiscountType;
    discount_value: number;
    calculated_discount: number;
    description: string;
  };
  error?: string;
  message?: string;
  minimum_order_amount?: number;
}

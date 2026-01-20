export interface PlatformCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_months';
  discount_value: number;
  applies_to: 'all' | 'new_tenants' | 'upgrade' | 'specific_plans';
  applicable_plan_ids: string[] | null;
  min_subscription_months: number | null;
  max_uses: number | null;
  used_count: number;
  max_uses_per_tenant: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  stripe_coupon_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformCouponFormData {
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_months';
  discount_value: number;
  applies_to: 'all' | 'new_tenants' | 'upgrade' | 'specific_plans';
  applicable_plan_ids?: string[];
  min_subscription_months?: number;
  max_uses?: number;
  max_uses_per_tenant?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface PlatformCouponRedemption {
  id: string;
  coupon_id: string;
  tenant_id: string;
  subscription_id: string | null;
  discount_applied: number;
  applied_by: string | null;
  redeemed_at: string;
  coupon?: PlatformCoupon;
  tenant?: {
    id: string;
    name: string;
  };
}

export interface PlatformQuickAction {
  id: string;
  name: string;
  description: string | null;
  action_type: 'gift_months' | 'add_credits' | 'apply_discount' | 'extend_trial' | 'unlock_feature';
  action_config: Record<string, unknown>;
  icon: string | null;
  color: string | null;
  requires_confirmation: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TenantLoyaltyReward {
  id: string;
  tenant_id: string;
  reward_type: 'anniversary' | 'milestone' | 'referral' | 'early_adopter' | 'custom';
  name: string;
  description: string | null;
  value: Record<string, unknown>;
  applied: boolean;
  applied_at: string | null;
  applied_by: string | null;
  expires_at: string | null;
  created_at: string;
}

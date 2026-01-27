export interface PricingPlanFeatures {
  // Branding & Support
  customDomain: boolean;
  removeWatermark: boolean;
  prioritySupport: boolean;
  whiteLabel: boolean;
  
  // Technical
  apiAccess: boolean;
  webhooks: boolean;
  advancedAnalytics: boolean;
  
  // Invoicing
  facturX: boolean;
  peppol: boolean;
  multiCurrency: boolean;
  
  // Modules
  pos: boolean;
  webshop_builder: boolean;
  visual_editor: boolean;
  
  // AI Capabilities
  ai_marketing: boolean;
  ai_copywriting: boolean;
  ai_images: boolean;
  ai_seo: boolean;
  ai_coach: boolean;
  ai_chatbot: boolean;
  ai_ab_testing: boolean;
  
  // Integrations
  bol_com: boolean;
  bol_vvb_labels: boolean;
  amazon: boolean;
  ebay: boolean;
  social_commerce: boolean;
  whatsapp: boolean;
  
  // Advanced Features
  shop_health: boolean;
  gamification: boolean;
  live_activity: boolean;
  loyalty_program: boolean;
  recurring_subscriptions: boolean;
  multi_warehouse: boolean;
  
  // Promotions
  promo_bundles: boolean;
  promo_bogo: boolean;
  promo_volume: boolean;
  promo_giftcards: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  limit_products: number | null;
  limit_orders: number | null;
  limit_customers: number | null;
  limit_users: number;
  limit_storage_gb: number;
  limit_api_calls: number | null;
  features: PricingPlanFeatures;
  highlighted: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Transaction limits
  included_transactions_monthly: number | null;
  transaction_overage_fee: number | null;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
export type BillingInterval = 'monthly' | 'yearly';

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  billing_interval: BillingInterval;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  pricing_plan?: PricingPlan;
}

export interface PlatformInvoice {
  id: string;
  tenant_id: string;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  invoice_number: string | null;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoice_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  invoice_pdf_url: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
}

export interface TenantUsage {
  products: number;
  orders: number;
  customers: number;
  storage: number;
  users: number;
}

export interface UsageLimit {
  current: number;
  limit: number | null;
  percentage: number;
}

export interface TenantUsageWithLimits {
  products: UsageLimit;
  orders: UsageLimit;
  customers: UsageLimit;
  storage: UsageLimit;
  users: UsageLimit;
}

export interface BillingMetrics {
  mrr: number;
  arr: number;
  payingCustomers: number;
  churnRate: number;
  byPlan: {
    planId: string;
    planName: string;
    count: number;
    mrr: number;
  }[];
}

// Payment method types
export type PaymentMethodType = 'stripe' | 'bank_transfer' | 'cash' | 'pin';

export interface TenantPaymentSettings {
  payment_methods_enabled: PaymentMethodType[];
  pass_transaction_fee_to_customer: boolean;
  transaction_fee_label: string;
}

export interface TransactionUsage {
  id: string;
  tenant_id: string;
  month_year: string;
  stripe_transactions: number;
  bank_transfer_transactions: number;
  pos_cash_transactions: number;
  pos_card_transactions: number;
  overage_fee_total: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionUsageWithLimits {
  usage: TransactionUsage | null;
  total_transactions: number;
  included_transactions: number; // -1 = unlimited
  remaining_transactions: number | null; // null = unlimited
  is_over_limit: boolean;
  overage_fee_per_transaction: number;
}

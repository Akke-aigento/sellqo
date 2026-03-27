import type { PricingPlan, PricingPlanFeatures, TenantSubscription, PlatformInvoice, TransactionUsage } from '@/types/billing';

// ============================================
// FEATURES
// ============================================

const allFeaturesOff: PricingPlanFeatures = {
  customDomain: false, removeWatermark: false, prioritySupport: false, whiteLabel: false,
  apiAccess: false, webhooks: false, advancedAnalytics: false,
  facturX: false, peppol: false, multiCurrency: false,
  pos: false, webshop_builder: false, visual_editor: false,
  ai_marketing: false, ai_copywriting: false, ai_images: false, ai_seo: false,
  ai_coach: false, ai_chatbot: false, ai_ab_testing: false,
  bol_com: false, bol_vvb_labels: false, amazon: false, ebay: false,
  social_commerce: false, whatsapp: false,
  shop_health: false, gamification: false, live_activity: false,
  loyalty_program: false, recurring_subscriptions: false, multi_warehouse: false,
  promo_bundles: false, promo_bogo: false, promo_volume: false, promo_giftcards: false,
};

const starterFeatures: PricingPlanFeatures = {
  ...allFeaturesOff,
  pos: true, webshop_builder: true, facturX: true, shop_health: true,
  ai_copywriting: true, ai_seo: true,
};

const proFeatures: PricingPlanFeatures = {
  ...starterFeatures,
  customDomain: true, removeWatermark: true, prioritySupport: true,
  apiAccess: true, webhooks: true, advancedAnalytics: true,
  peppol: true, visual_editor: true,
  ai_marketing: true, ai_images: true, ai_coach: true,
  bol_com: true, social_commerce: true, whatsapp: true,
  gamification: true, live_activity: true, loyalty_program: true,
  recurring_subscriptions: true,
  promo_bundles: true, promo_bogo: true, promo_volume: true, promo_giftcards: true,
};

const enterpriseFeatures: PricingPlanFeatures = {
  ...proFeatures,
  whiteLabel: true, multiCurrency: true,
  ai_chatbot: true, ai_ab_testing: true,
  bol_vvb_labels: true, amazon: true, ebay: true,
  multi_warehouse: true,
};

// ============================================
// PLANS
// ============================================

export const freePlan: PricingPlan = {
  id: 'free', name: 'Free', slug: 'free',
  monthly_price: 0, yearly_price: 0, currency: 'EUR',
  stripe_product_id: null, stripe_price_id_monthly: null, stripe_price_id_yearly: null,
  limit_products: 25, limit_orders: 50, limit_customers: 100,
  limit_users: 1, limit_storage_gb: 1, limit_api_calls: null,
  features: allFeaturesOff, highlighted: false, sort_order: 0, active: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  included_transactions_monthly: 10, transaction_overage_fee: 0.50,
};

export const starterPlan: PricingPlan = {
  id: 'starter', name: 'Starter', slug: 'starter',
  monthly_price: 29, yearly_price: 290, currency: 'EUR',
  stripe_product_id: 'prod_starter', stripe_price_id_monthly: 'price_starter_monthly', stripe_price_id_yearly: 'price_starter_yearly',
  limit_products: 250, limit_orders: 500, limit_customers: 1000,
  limit_users: 3, limit_storage_gb: 5, limit_api_calls: null,
  features: starterFeatures, highlighted: false, sort_order: 1, active: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  included_transactions_monthly: 100, transaction_overage_fee: 0.25,
};

export const proPlan: PricingPlan = {
  id: 'pro', name: 'Pro', slug: 'pro',
  monthly_price: 79, yearly_price: 790, currency: 'EUR',
  stripe_product_id: 'prod_pro', stripe_price_id_monthly: 'price_pro_monthly', stripe_price_id_yearly: 'price_pro_yearly',
  limit_products: 2500, limit_orders: 5000, limit_customers: 10000,
  limit_users: 10, limit_storage_gb: 25, limit_api_calls: null,
  features: proFeatures, highlighted: true, sort_order: 2, active: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  included_transactions_monthly: 500, transaction_overage_fee: 0.10,
};

export const enterprisePlan: PricingPlan = {
  id: 'enterprise', name: 'Enterprise', slug: 'enterprise',
  monthly_price: 199, yearly_price: 1990, currency: 'EUR',
  stripe_product_id: 'prod_enterprise', stripe_price_id_monthly: 'price_enterprise_monthly', stripe_price_id_yearly: 'price_enterprise_yearly',
  limit_products: null, limit_orders: null, limit_customers: null,
  limit_users: 50, limit_storage_gb: 100, limit_api_calls: null,
  features: enterpriseFeatures, highlighted: false, sort_order: 3, active: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  included_transactions_monthly: -1, transaction_overage_fee: 0,
};

export const allPlans = [freePlan, starterPlan, proPlan, enterprisePlan];

// ============================================
// TENANTS
// ============================================

export const regularTenant = {
  id: 'tenant-1',
  slug: 'test-shop',
  name: 'Test Shop',
  owner_email: 'owner@testshop.com',
  is_internal_tenant: false,
  is_demo: false,
  stripe_customer_id: 'cus_test123',
  subscription_status: 'active',
  subscription_plan: 'starter',
};

export const internalTenant = {
  id: 'tenant-internal',
  slug: 'sellqo',
  name: 'SellQo Platform',
  owner_email: 'admin@sellqo.com',
  is_internal_tenant: true,
  is_demo: false,
  stripe_customer_id: null,
  subscription_status: 'active',
  subscription_plan: 'enterprise',
};

export const demoTenant = {
  id: 'tenant-demo',
  slug: 'demo-shop',
  name: 'Demo Shop',
  owner_email: 'demo@sellqo.com',
  is_internal_tenant: false,
  is_demo: true,
  stripe_customer_id: null,
  subscription_status: 'active',
  subscription_plan: 'pro',
};

// ============================================
// SUBSCRIPTIONS
// ============================================

const now = new Date();
const inFuture = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
const inPast = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

export const trialSubscription: TenantSubscription = {
  id: 'sub-trial',
  tenant_id: 'tenant-1',
  plan_id: 'starter',
  billing_interval: 'monthly',
  stripe_customer_id: 'cus_test123',
  stripe_subscription_id: 'sub_stripe_trial',
  stripe_payment_method_id: null,
  status: 'trialing',
  current_period_start: inPast(7),
  current_period_end: inFuture(7),
  trial_end: inFuture(7),
  canceled_at: null,
  cancel_at_period_end: false,
  last_payment_date: null,
  last_payment_amount: null,
  created_at: inPast(7),
  updated_at: inPast(7),
  pricing_plan: starterPlan,
};

export const expiredTrialSubscription: TenantSubscription = {
  ...trialSubscription,
  id: 'sub-expired-trial',
  trial_end: inPast(1),
  current_period_end: inPast(1),
};

export const activeSubscription: TenantSubscription = {
  id: 'sub-active',
  tenant_id: 'tenant-1',
  plan_id: 'starter',
  billing_interval: 'monthly',
  stripe_customer_id: 'cus_test123',
  stripe_subscription_id: 'sub_stripe_active',
  stripe_payment_method_id: 'pm_test123',
  status: 'active',
  current_period_start: inPast(15),
  current_period_end: inFuture(15),
  trial_end: null,
  canceled_at: null,
  cancel_at_period_end: false,
  last_payment_date: inPast(15),
  last_payment_amount: 29,
  created_at: inPast(60),
  updated_at: inPast(15),
  pricing_plan: starterPlan,
};

export const pastDueSubscription: TenantSubscription = {
  ...activeSubscription,
  id: 'sub-past-due',
  status: 'past_due',
};

export const canceledSubscription: TenantSubscription = {
  ...activeSubscription,
  id: 'sub-canceled',
  status: 'canceled',
  canceled_at: inPast(1),
};

export const proSubscription: TenantSubscription = {
  ...activeSubscription,
  id: 'sub-pro',
  plan_id: 'pro',
  pricing_plan: proPlan,
  last_payment_amount: 79,
};

// ============================================
// INVOICES
// ============================================

export const paidInvoice: PlatformInvoice = {
  id: 'inv-1',
  tenant_id: 'tenant-1',
  stripe_invoice_id: 'in_test123',
  stripe_charge_id: 'ch_test123',
  invoice_number: 'SQ-2026-001',
  amount: 29,
  currency: 'EUR',
  status: 'paid',
  invoice_date: inPast(30),
  due_date: inPast(30),
  paid_at: inPast(30),
  period_start: inPast(60),
  period_end: inPast(30),
  invoice_pdf_url: 'https://stripe.com/invoice/pdf/in_test123',
  hosted_invoice_url: 'https://stripe.com/invoice/in_test123',
  created_at: inPast(30),
};

export const openInvoice: PlatformInvoice = {
  ...paidInvoice,
  id: 'inv-2',
  stripe_invoice_id: 'in_test456',
  invoice_number: 'SQ-2026-002',
  status: 'open',
  paid_at: null,
  invoice_date: inPast(5),
  due_date: inFuture(25),
  period_start: inPast(30),
  period_end: inPast(0),
  created_at: inPast(5),
};

// ============================================
// TRANSACTION USAGE
// ============================================

export const normalUsage: TransactionUsage = {
  id: 'tu-1',
  tenant_id: 'tenant-1',
  month_year: now.toISOString().slice(0, 7),
  stripe_transactions: 30,
  bank_transfer_transactions: 10,
  pos_cash_transactions: 5,
  pos_card_transactions: 15,
  overage_fee_total: 0,
  created_at: inPast(5),
  updated_at: inPast(0),
};

export const overLimitUsage: TransactionUsage = {
  ...normalUsage,
  id: 'tu-2',
  stripe_transactions: 80,
  bank_transfer_transactions: 20,
  pos_cash_transactions: 10,
  pos_card_transactions: 15,
  overage_fee_total: 6.25,
};

// ============================================
// ADDONS
// ============================================

export const peppolAddon = {
  id: 'addon-1',
  tenant_id: 'tenant-1',
  addon_type: 'peppol',
  status: 'active' as const,
  stripe_subscription_id: 'sub_addon_peppol',
  stripe_price_id: 'price_peppol',
  price_monthly: 9.99,
  activated_at: inPast(30),
  cancelled_at: null,
  created_at: inPast(30),
  updated_at: inPast(30),
};

export const multiWarehouseAddon = {
  id: 'addon-2',
  tenant_id: 'tenant-1',
  addon_type: 'multi_warehouse',
  status: 'active' as const,
  stripe_subscription_id: 'sub_addon_warehouse',
  stripe_price_id: 'price_warehouse',
  price_monthly: 14.99,
  activated_at: inPast(20),
  cancelled_at: null,
  created_at: inPast(20),
  updated_at: inPast(20),
};

// ============================================
// STRIPE WEBHOOK EVENTS
// ============================================

export function makeStripeSubscriptionEvent(
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted',
  overrides: Record<string, unknown> = {}
) {
  return {
    type,
    data: {
      object: {
        id: 'sub_stripe_123',
        customer: 'cus_test123',
        status: 'active',
        metadata: { tenantId: 'tenant-1', planId: 'starter' },
        items: { data: [{ price: { id: 'price_starter_monthly' } }] },
        current_period_start: Math.floor(Date.now() / 1000) - 86400 * 15,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 15,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        ...overrides,
      },
    },
  };
}

export function makeStripeInvoiceEvent(
  type: 'invoice.paid' | 'invoice.payment_failed',
  overrides: Record<string, unknown> = {}
) {
  return {
    type,
    data: {
      object: {
        id: 'in_test789',
        customer: 'cus_test123',
        number: 'SQ-2026-003',
        amount_paid: 2900,
        currency: 'eur',
        charge: 'ch_test789',
        created: Math.floor(Date.now() / 1000),
        period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
        period_end: Math.floor(Date.now() / 1000),
        status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
        invoice_pdf: 'https://stripe.com/invoice/pdf/in_test789',
        hosted_invoice_url: 'https://stripe.com/invoice/in_test789',
        ...overrides,
      },
    },
  };
}

export function makeStripePayoutEvent(
  type: 'payout.created' | 'payout.paid' | 'payout.failed' | 'payout.canceled',
  overrides: Record<string, unknown> = {}
) {
  return {
    type,
    account: 'acct_connect_123',
    data: {
      object: {
        id: 'po_test123',
        amount: 15000,
        currency: 'eur',
        destination: 'ba_test123',
        arrival_date: Math.floor(Date.now() / 1000) + 86400 * 2,
        failure_code: null,
        failure_message: null,
        ...overrides,
      },
    },
  };
}

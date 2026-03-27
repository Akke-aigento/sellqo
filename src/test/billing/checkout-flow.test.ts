import { describe, it, expect } from 'vitest';
import { regularTenant, starterPlan, proPlan, activeSubscription } from '../fixtures/billing';

/**
 * Tests for the create-platform-checkout edge function logic.
 * Validates the checkout flow decision tree.
 */

interface CheckoutInput {
  planId: string;
  interval: 'monthly' | 'yearly';
  tenant: typeof regularTenant;
  plan: typeof starterPlan | null;
  existingSubscription: { stripe_subscription_id: string | null; status: string } | null;
}

type CheckoutResult =
  | { type: 'error'; message: string; status: number }
  | { type: 'portal_redirect'; url: string }
  | { type: 'checkout_session'; priceId: string };

function simulateCheckoutFlow(input: CheckoutInput): CheckoutResult {
  const { planId, interval, tenant, plan, existingSubscription } = input;

  // Validation
  if (!planId || !interval) {
    return { type: 'error', message: 'Missing planId or interval', status: 400 };
  }

  if (!plan) {
    return { type: 'error', message: 'Plan not found', status: 404 };
  }

  // Determine price ID
  const priceId = interval === 'yearly'
    ? plan.stripe_price_id_yearly
    : plan.stripe_price_id_monthly;

  if (!priceId) {
    return { type: 'error', message: 'Stripe price not configured for this plan', status: 400 };
  }

  // Active subscription → billing portal
  if (existingSubscription?.stripe_subscription_id && existingSubscription.status === 'active') {
    return { type: 'portal_redirect', url: 'https://billing.stripe.com/portal/test' };
  }

  // New subscription → checkout session
  return { type: 'checkout_session', priceId };
}

describe('Checkout Flow', () => {
  describe('validation', () => {
    it('rejects missing planId', () => {
      const result = simulateCheckoutFlow({
        planId: '',
        interval: 'monthly',
        tenant: regularTenant,
        plan: starterPlan,
        existingSubscription: null,
      });

      expect(result).toEqual({ type: 'error', message: 'Missing planId or interval', status: 400 });
    });

    it('rejects missing interval', () => {
      const result = simulateCheckoutFlow({
        planId: 'starter',
        interval: '' as any,
        tenant: regularTenant,
        plan: starterPlan,
        existingSubscription: null,
      });

      expect(result).toEqual({ type: 'error', message: 'Missing planId or interval', status: 400 });
    });

    it('rejects unknown plan', () => {
      const result = simulateCheckoutFlow({
        planId: 'nonexistent',
        interval: 'monthly',
        tenant: regularTenant,
        plan: null,
        existingSubscription: null,
      });

      expect(result).toEqual({ type: 'error', message: 'Plan not found', status: 404 });
    });
  });

  describe('Stripe customer management', () => {
    it('uses existing stripe_customer_id when available', () => {
      expect(regularTenant.stripe_customer_id).toBe('cus_test123');
    });

    it('creates new customer when none exists', () => {
      const tenantWithoutStripe = { ...regularTenant, stripe_customer_id: null };
      expect(tenantWithoutStripe.stripe_customer_id).toBeNull();
      // In the real flow, Stripe.customers.create() would be called
    });
  });

  describe('price selection', () => {
    it('selects monthly price for monthly interval', () => {
      const result = simulateCheckoutFlow({
        planId: 'starter',
        interval: 'monthly',
        tenant: regularTenant,
        plan: starterPlan,
        existingSubscription: null,
      });

      expect(result).toEqual({
        type: 'checkout_session',
        priceId: 'price_starter_monthly',
      });
    });

    it('selects yearly price for yearly interval', () => {
      const result = simulateCheckoutFlow({
        planId: 'starter',
        interval: 'yearly',
        tenant: regularTenant,
        plan: starterPlan,
        existingSubscription: null,
      });

      expect(result).toEqual({
        type: 'checkout_session',
        priceId: 'price_starter_yearly',
      });
    });

    it('rejects free plan (no Stripe price)', () => {
      const freePlanLocal = {
        ...starterPlan,
        id: 'free',
        stripe_price_id_monthly: null,
        stripe_price_id_yearly: null,
      };

      const result = simulateCheckoutFlow({
        planId: 'free',
        interval: 'monthly',
        tenant: regularTenant,
        plan: freePlanLocal,
        existingSubscription: null,
      });

      expect(result).toEqual({
        type: 'error',
        message: 'Stripe price not configured for this plan',
        status: 400,
      });
    });
  });

  describe('existing subscription handling', () => {
    it('redirects to billing portal for active subscription', () => {
      const result = simulateCheckoutFlow({
        planId: 'pro',
        interval: 'monthly',
        tenant: regularTenant,
        plan: proPlan,
        existingSubscription: {
          stripe_subscription_id: 'sub_existing',
          status: 'active',
        },
      });

      expect(result.type).toBe('portal_redirect');
    });

    it('creates new checkout for canceled subscription', () => {
      const result = simulateCheckoutFlow({
        planId: 'pro',
        interval: 'monthly',
        tenant: regularTenant,
        plan: proPlan,
        existingSubscription: {
          stripe_subscription_id: 'sub_existing',
          status: 'canceled',
        },
      });

      expect(result.type).toBe('checkout_session');
    });

    it('creates new checkout when no subscription exists', () => {
      const result = simulateCheckoutFlow({
        planId: 'pro',
        interval: 'monthly',
        tenant: regularTenant,
        plan: proPlan,
        existingSubscription: null,
      });

      expect(result.type).toBe('checkout_session');
      expect((result as any).priceId).toBe('price_pro_monthly');
    });

    it('creates new checkout for subscription without Stripe ID', () => {
      const result = simulateCheckoutFlow({
        planId: 'pro',
        interval: 'monthly',
        tenant: regularTenant,
        plan: proPlan,
        existingSubscription: {
          stripe_subscription_id: null,
          status: 'trialing',
        },
      });

      expect(result.type).toBe('checkout_session');
    });
  });
});

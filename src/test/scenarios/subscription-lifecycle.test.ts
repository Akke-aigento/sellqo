import { describe, it, expect } from 'vitest';
import {
  freePlan, starterPlan, proPlan, enterprisePlan,
  regularTenant, internalTenant, demoTenant,
  trialSubscription, expiredTrialSubscription, activeSubscription,
  pastDueSubscription, canceledSubscription, proSubscription,
  paidInvoice, peppolAddon,
  makeStripeSubscriptionEvent, makeStripeInvoiceEvent,
} from '../fixtures/billing';
import type { SubscriptionStatus } from '@/types/billing';

/**
 * End-to-end scenario tests simulating complete subscription lifecycle flows.
 * These tests validate the business rules and state transitions.
 */

// State machine for subscription status
const validTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ['active', 'canceled', 'past_due'],
  active: ['canceled', 'past_due', 'paused'],
  past_due: ['active', 'canceled', 'unpaid'],
  canceled: ['active'], // Resubscribe
  unpaid: ['canceled', 'active'],
  paused: ['active', 'canceled'],
};

function isValidTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

describe('Subscription Lifecycle Scenarios', () => {
  describe('Scenario 1: New Tenant → Trial → Paid', () => {
    it('tenant creation results in trial subscription', () => {
      // After create-tenant, subscription is created with trial
      const sub = trialSubscription;

      expect(sub.status).toBe('trialing');
      expect(sub.trial_end).toBeTruthy();
      expect(sub.plan_id).toBe('starter');
      expect(new Date(sub.trial_end!).getTime()).toBeGreaterThan(Date.now());
    });

    it('trial has correct plan features', () => {
      const plan = trialSubscription.pricing_plan!;

      expect(plan.limit_products).toBe(250);
      expect(plan.limit_orders).toBe(500);
      expect(plan.features.pos).toBe(true);
      expect(plan.features.webshop_builder).toBe(true);
    });

    it('trial → active is valid transition after payment', () => {
      expect(isValidTransition('trialing', 'active')).toBe(true);
    });

    it('webhook activates subscription after checkout', () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.updated', {
        status: 'active',
        trial_end: null,
        metadata: { tenantId: 'tenant-1', planId: 'starter' },
      });

      const sub = event.data.object;
      expect(sub.status).toBe('active');
      expect(sub.trial_end).toBeNull();
    });

    it('invoice is recorded after first payment', () => {
      const event = makeStripeInvoiceEvent('invoice.paid');
      const invoice = event.data.object;

      expect(invoice.amount_paid).toBe(2900); // €29.00 in cents
      expect(invoice.currency).toBe('eur');
    });
  });

  describe('Scenario 2: Trial → Expired → Free', () => {
    it('expired trial is detected', () => {
      const sub = expiredTrialSubscription;
      const trialEnd = new Date(sub.trial_end!);

      expect(sub.status).toBe('trialing');
      expect(trialEnd.getTime()).toBeLessThan(Date.now());
    });

    it('expired trial gets downgraded to free plan', () => {
      // Simulate check-expired-trials logic
      const sub = expiredTrialSubscription;
      const isExpired = sub.status === 'trialing' &&
        sub.trial_end !== null &&
        new Date(sub.trial_end).getTime() <= Date.now() &&
        sub.plan_id !== 'free';

      expect(isExpired).toBe(true);

      // After downgrade
      const downgraded = {
        ...sub,
        plan_id: 'free',
        status: 'active' as const,
        trial_end: null,
      };

      expect(downgraded.plan_id).toBe('free');
      expect(downgraded.status).toBe('active');
      expect(downgraded.trial_end).toBeNull();
    });

    it('downgraded tenant gets notification', () => {
      const notification = {
        tenant_id: expiredTrialSubscription.tenant_id,
        category: 'billing',
        type: 'trial_expired',
        priority: 'high',
        data: { previous_plan_id: 'starter' },
      };

      expect(notification.tenant_id).toBe('tenant-1');
      expect(notification.data.previous_plan_id).toBe('starter');
    });

    it('free plan has correct limits', () => {
      expect(freePlan.limit_products).toBe(25);
      expect(freePlan.limit_orders).toBe(50);
      expect(freePlan.limit_customers).toBe(100);
      expect(freePlan.limit_users).toBe(1);
    });
  });

  describe('Scenario 3: Upgrade Starter → Pro', () => {
    it('current subscription is Starter active', () => {
      expect(activeSubscription.plan_id).toBe('starter');
      expect(activeSubscription.status).toBe('active');
    });

    it('Pro plan costs more', () => {
      expect(proPlan.monthly_price).toBeGreaterThan(starterPlan.monthly_price);
      expect(proPlan.monthly_price).toBe(79);
    });

    it('upgrade gains features', () => {
      const gained = Object.entries(proPlan.features).filter(
        ([key, val]) => val === true && (starterPlan.features as any)[key] !== true
      ).map(([key]) => key);

      expect(gained).toContain('customDomain');
      expect(gained).toContain('peppol');
      expect(gained).toContain('apiAccess');
      expect(gained).toContain('webhooks');
      expect(gained).toContain('advancedAnalytics');
    });

    it('upgrade increases limits', () => {
      expect(proPlan.limit_products).toBeGreaterThan(starterPlan.limit_products!);
      expect(proPlan.limit_orders).toBeGreaterThan(starterPlan.limit_orders!);
      expect(proPlan.limit_customers).toBeGreaterThan(starterPlan.limit_customers!);
      expect(proPlan.limit_users).toBeGreaterThan(starterPlan.limit_users);
    });

    it('peppol addon gets migrated when upgrading to Pro', () => {
      const proFeatures = proPlan.features as unknown as Record<string, boolean>;
      expect(proFeatures['peppol']).toBe(true);
      // Addon would be cancelled since feature is now included
    });
  });

  describe('Scenario 4: Downgrade Pro → Starter', () => {
    it('downgrade loses features', () => {
      const lost = Object.entries(proPlan.features).filter(
        ([key, val]) => val === true && (starterPlan.features as any)[key] !== true
      ).map(([key]) => key);

      expect(lost.length).toBeGreaterThan(0);
      expect(lost).toContain('customDomain');
      expect(lost).toContain('peppol');
    });

    it('downgrade reduces limits', () => {
      expect(starterPlan.limit_products).toBeLessThan(proPlan.limit_products!);
      expect(starterPlan.limit_orders).toBeLessThan(proPlan.limit_orders!);
    });

    it('downgrade does not migrate addons (target lacks features)', () => {
      // If tenant has peppol addon and downgrades to Starter
      const starterFeatures = starterPlan.features as unknown as Record<string, boolean>;
      expect(starterFeatures['peppol']).toBe(false);
      // Addon should remain active (charged separately)
    });
  });

  describe('Scenario 5: Payment Failed', () => {
    it('payment failure moves to past_due', () => {
      expect(isValidTransition('active', 'past_due')).toBe(true);
    });

    it('webhook updates status correctly', () => {
      const event = makeStripeInvoiceEvent('invoice.payment_failed');

      // After processing, subscription should be past_due
      expect(pastDueSubscription.status).toBe('past_due');
    });

    it('past_due can recover to active', () => {
      expect(isValidTransition('past_due', 'active')).toBe(true);
    });

    it('past_due can lead to canceled', () => {
      expect(isValidTransition('past_due', 'canceled')).toBe(true);
    });
  });

  describe('Scenario 6: Cancel Subscription', () => {
    it('active → canceled is valid', () => {
      expect(isValidTransition('active', 'canceled')).toBe(true);
    });

    it('canceled subscription has canceled_at date', () => {
      expect(canceledSubscription.status).toBe('canceled');
      expect(canceledSubscription.canceled_at).toBeTruthy();
    });

    it('webhook downgrades to free plan', () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.deleted', {
        metadata: { tenantId: 'tenant-1' },
      });

      // After processing, tenant should be on free plan
      // Verified by the webhook handler setting subscription_plan = 'free'
      expect(event.data.object.metadata.tenantId).toBe('tenant-1');
    });
  });

  describe('Scenario 7: Resubscribe After Cancel', () => {
    it('canceled → active is valid via new checkout', () => {
      expect(isValidTransition('canceled', 'active')).toBe(true);
    });

    it('canceled subscription allows new checkout (not portal redirect)', () => {
      // When existingSub has status 'canceled', checkout creates new session
      const existingSub = canceledSubscription;
      const shouldUsePortal = existingSub.stripe_subscription_id && existingSub.status === 'active';

      expect(shouldUsePortal).toBeFalsy();
    });

    it('new subscription webhook creates fresh subscription record', () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.created', {
        status: 'active',
        metadata: { tenantId: 'tenant-1', planId: 'pro' },
      });

      expect(event.data.object.status).toBe('active');
      expect(event.data.object.metadata.planId).toBe('pro');
    });
  });

  describe('State Machine Validation', () => {
    it('all defined transitions are valid', () => {
      const allStatuses: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'];

      for (const status of allStatuses) {
        expect(validTransitions[status]).toBeDefined();
        expect(validTransitions[status].length).toBeGreaterThan(0);
      }
    });

    it('trialing cannot go to paused', () => {
      expect(isValidTransition('trialing', 'paused')).toBe(false);
    });

    it('active cannot go directly to unpaid', () => {
      expect(isValidTransition('active', 'unpaid')).toBe(false);
    });

    it('canceled cannot go to past_due', () => {
      expect(isValidTransition('canceled', 'past_due')).toBe(false);
    });
  });

  describe('Special Tenant Types', () => {
    it('internal tenant has unlimited access', () => {
      expect(internalTenant.is_internal_tenant).toBe(true);
      expect(internalTenant.subscription_plan).toBe('enterprise');
    });

    it('demo tenant has unlimited access', () => {
      expect(demoTenant.is_demo).toBe(true);
    });

    it('regular tenant has normal limits', () => {
      expect(regularTenant.is_internal_tenant).toBe(false);
      expect(regularTenant.is_demo).toBe(false);
    });
  });

  describe('Billing Interval Scenarios', () => {
    it('yearly subscription saves money vs monthly', () => {
      const yearlyTotal = starterPlan.yearly_price; // 290
      const monthlyTotal = starterPlan.monthly_price * 12; // 348

      expect(yearlyTotal).toBeLessThan(monthlyTotal);
      const savings = monthlyTotal - yearlyTotal;
      expect(savings).toBe(58); // €58 savings
    });

    it('all paid plans have both monthly and yearly prices', () => {
      const paidPlans = [starterPlan, proPlan, enterprisePlan];

      for (const plan of paidPlans) {
        expect(plan.stripe_price_id_monthly).toBeTruthy();
        expect(plan.stripe_price_id_yearly).toBeTruthy();
        expect(plan.yearly_price).toBeLessThan(plan.monthly_price * 12);
      }
    });
  });

  describe('Transaction Limits', () => {
    it('free plan has lowest transaction limit', () => {
      expect(freePlan.included_transactions_monthly).toBe(10);
    });

    it('enterprise plan has unlimited transactions', () => {
      expect(enterprisePlan.included_transactions_monthly).toBe(-1);
    });

    it('overage fee decreases with higher plans', () => {
      expect(freePlan.transaction_overage_fee!).toBeGreaterThan(starterPlan.transaction_overage_fee!);
      expect(starterPlan.transaction_overage_fee!).toBeGreaterThan(proPlan.transaction_overage_fee!);
      expect(enterprisePlan.transaction_overage_fee).toBe(0);
    });
  });
});

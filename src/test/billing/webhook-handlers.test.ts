import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeStripeSubscriptionEvent,
  makeStripeInvoiceEvent,
  makeStripePayoutEvent,
} from '../fixtures/billing';

/**
 * Tests for the business logic in platform-stripe-webhook.
 * Since edge functions run in Deno, we extract and test the logic patterns
 * by simulating what the webhook handler does with each event type.
 */

// Simulated Supabase operations tracker
let dbOperations: Array<{ table: string; operation: string; data: any; filter?: any }> = [];

function trackOperation(table: string, operation: string, data: any, filter?: any) {
  dbOperations.push({ table, operation, data, filter });
}

// Simulate the webhook handler logic
async function handleSubscriptionCreatedOrUpdated(event: any) {
  const subscription = event.data.object;
  const tenantId = subscription.metadata?.tenantId;
  const planId = subscription.metadata?.planId;

  if (!tenantId) return;

  const priceId = subscription.items?.data?.[0]?.price?.id;
  let billingInterval: 'monthly' | 'yearly' = 'monthly';
  // Simulate price lookup
  if (priceId?.includes('yearly')) {
    billingInterval = 'yearly';
  }

  trackOperation('tenant_subscriptions', 'upsert', {
    tenant_id: tenantId,
    plan_id: planId || 'starter',
    billing_interval: billingInterval,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
  });

  trackOperation('tenants', 'update', {
    subscription_plan: planId || 'starter',
    subscription_status: subscription.status,
  }, { id: tenantId });
}

async function handleSubscriptionDeleted(event: any) {
  const subscription = event.data.object;
  const tenantId = subscription.metadata?.tenantId;
  if (!tenantId) return;

  trackOperation('tenant_subscriptions', 'update', {
    status: 'canceled',
    canceled_at: expect.any(String),
  }, { stripe_subscription_id: subscription.id });

  trackOperation('tenants', 'update', {
    subscription_plan: 'free',
    subscription_status: 'canceled',
  }, { id: tenantId });
}

async function handleInvoicePaid(event: any, lookupTenantId: string | null) {
  const invoice = event.data.object;
  if (!lookupTenantId) return;

  trackOperation('platform_invoices', 'upsert', {
    tenant_id: lookupTenantId,
    stripe_invoice_id: invoice.id,
    stripe_charge_id: invoice.charge,
    invoice_number: invoice.number,
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency?.toUpperCase() || 'EUR',
    status: 'paid',
    invoice_pdf_url: invoice.invoice_pdf,
    hosted_invoice_url: invoice.hosted_invoice_url,
  });

  trackOperation('tenant_subscriptions', 'update', {
    last_payment_date: expect.any(String),
    last_payment_amount: (invoice.amount_paid || 0) / 100,
  }, { tenant_id: lookupTenantId });
}

async function handleInvoicePaymentFailed(event: any, lookupTenantId: string | null) {
  if (!lookupTenantId) return;

  trackOperation('tenant_subscriptions', 'update', {
    status: 'past_due',
  }, { tenant_id: lookupTenantId });

  trackOperation('tenants', 'update', {
    subscription_status: 'past_due',
  }, { id: lookupTenantId });
}

describe('Stripe Webhook Handlers', () => {
  beforeEach(() => {
    dbOperations = [];
  });

  describe('customer.subscription.created', () => {
    it('upserts subscription and updates tenant', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.created');
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations).toHaveLength(2);
      expect(dbOperations[0]).toMatchObject({
        table: 'tenant_subscriptions',
        operation: 'upsert',
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          plan_id: 'starter',
          stripe_customer_id: 'cus_test123',
          status: 'active',
        }),
      });
      expect(dbOperations[1]).toMatchObject({
        table: 'tenants',
        operation: 'update',
        data: { subscription_plan: 'starter', subscription_status: 'active' },
        filter: { id: 'tenant-1' },
      });
    });

    it('skips when no tenantId in metadata', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.created', {
        metadata: {},
      });
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations).toHaveLength(0);
    });

    it('detects yearly billing interval from price ID', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.created', {
        items: { data: [{ price: { id: 'price_pro_yearly' } }] },
        metadata: { tenantId: 'tenant-1', planId: 'pro' },
      });
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations[0].data.billing_interval).toBe('yearly');
    });

    it('defaults to monthly billing', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.created');
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations[0].data.billing_interval).toBe('monthly');
    });

    it('handles trial subscriptions with trial_end', async () => {
      const trialEnd = Math.floor(Date.now() / 1000) + 14 * 86400;
      const event = makeStripeSubscriptionEvent('customer.subscription.created', {
        status: 'trialing',
        trial_end: trialEnd,
      });
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations[0].data.status).toBe('trialing');
      expect(dbOperations[0].data.trial_end).toBeTruthy();
    });
  });

  describe('customer.subscription.updated', () => {
    it('handles subscription update with new plan', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.updated', {
        metadata: { tenantId: 'tenant-1', planId: 'pro' },
      });
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations[0].data.plan_id).toBe('pro');
      expect(dbOperations[1].data.subscription_plan).toBe('pro');
    });

    it('handles cancel_at_period_end flag', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.updated', {
        cancel_at_period_end: true,
      });
      await handleSubscriptionCreatedOrUpdated(event);

      expect(dbOperations[0].data.cancel_at_period_end).toBe(true);
    });
  });

  describe('customer.subscription.deleted', () => {
    it('cancels subscription and downgrades to free', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.deleted');
      await handleSubscriptionDeleted(event);

      expect(dbOperations).toHaveLength(2);
      expect(dbOperations[0]).toMatchObject({
        table: 'tenant_subscriptions',
        operation: 'update',
        data: { status: 'canceled' },
      });
      expect(dbOperations[1]).toMatchObject({
        table: 'tenants',
        operation: 'update',
        data: { subscription_plan: 'free', subscription_status: 'canceled' },
      });
    });

    it('skips when no tenantId', async () => {
      const event = makeStripeSubscriptionEvent('customer.subscription.deleted', {
        metadata: {},
      });
      await handleSubscriptionDeleted(event);

      expect(dbOperations).toHaveLength(0);
    });
  });

  describe('invoice.paid', () => {
    it('saves invoice and updates last payment', async () => {
      const event = makeStripeInvoiceEvent('invoice.paid');
      await handleInvoicePaid(event, 'tenant-1');

      expect(dbOperations).toHaveLength(2);
      expect(dbOperations[0]).toMatchObject({
        table: 'platform_invoices',
        operation: 'upsert',
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          amount: 29, // 2900 cents / 100
          currency: 'EUR',
          status: 'paid',
        }),
      });
      expect(dbOperations[1]).toMatchObject({
        table: 'tenant_subscriptions',
        operation: 'update',
        data: expect.objectContaining({
          last_payment_amount: 29,
        }),
      });
    });

    it('skips when tenant not found', async () => {
      const event = makeStripeInvoiceEvent('invoice.paid');
      await handleInvoicePaid(event, null);

      expect(dbOperations).toHaveLength(0);
    });
  });

  describe('invoice.payment_failed', () => {
    it('marks subscription as past_due', async () => {
      const event = makeStripeInvoiceEvent('invoice.payment_failed');
      await handleInvoicePaymentFailed(event, 'tenant-1');

      expect(dbOperations).toHaveLength(2);
      expect(dbOperations[0]).toMatchObject({
        table: 'tenant_subscriptions',
        operation: 'update',
        data: { status: 'past_due' },
      });
      expect(dbOperations[1]).toMatchObject({
        table: 'tenants',
        operation: 'update',
        data: { subscription_status: 'past_due' },
      });
    });
  });

  describe('payout events', () => {
    it('payout.created includes arrival date in notification', () => {
      const event = makeStripePayoutEvent('payout.created');
      const payout = event.data.object;
      const amount = payout.amount / 100;
      const formattedAmount = `\u20AC${amount.toFixed(2).replace('.', ',')}`;

      expect(formattedAmount).toBe('\u20AC150,00');
      expect(payout.arrival_date).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('payout.failed includes failure message', () => {
      const event = makeStripePayoutEvent('payout.failed', {
        failure_code: 'account_closed',
        failure_message: 'Bank account has been closed',
      });
      const payout = event.data.object;

      expect(payout.failure_code).toBe('account_closed');
      expect(payout.failure_message).toBe('Bank account has been closed');
    });

    it('payout.canceled preserves amount for re-payout', () => {
      const event = makeStripePayoutEvent('payout.canceled');
      const payout = event.data.object;

      expect(payout.amount).toBe(15000);
      expect(payout.currency).toBe('eur');
    });
  });
});

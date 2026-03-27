import { vi } from 'vitest';

/**
 * Mock Stripe API responses for testing edge function logic.
 */
export function createMockStripe() {
  return {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_new123' }),
      retrieve: vi.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@test.com' }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue({
        id: 'sub_new123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        items: { data: [{ id: 'si_123', price: { id: 'price_starter_monthly' } }] },
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_stripe_active',
        status: 'active',
        items: { data: [{ id: 'si_123', price: { id: 'price_starter_monthly' } }] },
        current_period_start: Math.floor(Date.now() / 1000) - 15 * 86400,
        current_period_end: Math.floor(Date.now() / 1000) + 15 * 86400,
      }),
      update: vi.fn().mockResolvedValue({
        id: 'sub_stripe_active',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      }),
      cancel: vi.fn().mockResolvedValue({ id: 'sub_cancelled', status: 'canceled' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/cs_test123',
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          url: 'https://billing.stripe.com/portal/test',
        }),
      },
    },
    invoices: {
      retrieveUpcoming: vi.fn().mockResolvedValue({
        subtotal: 7900,
        tax: 1659,
        total: 9559,
        currency: 'eur',
      }),
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((body, signature, secret) => {
        return JSON.parse(body);
      }),
    },
  };
}

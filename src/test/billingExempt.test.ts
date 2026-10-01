import { describe, expect, it } from 'vitest';
import { isBillingExempt } from '../../supabase/functions/_shared/billingExempt';
import { resolveStripeRouting } from '../../supabase/functions/_shared/stripeRouting';
import { groupTenants } from '@/lib/tenantGroups';

// BILLING-EXEMPT-1 — "geen SellQo-facturatie" (billing_exempt) los van "SellQo zelf" (is_internal_tenant).

describe('resolveStripeRouting — alleen is_internal_tenant gaat naar het platformaccount', () => {
  it('SellQo zelf (intern) → platform, ook zonder Connect-account', () => {
    expect(resolveStripeRouting({ id: 'sellqo', is_internal_tenant: true, stripe_account_id: null })).toEqual({ account: 'platform' });
  });

  it('Studio Akke: intern zonder Connect-account → platform (mail-billing-api blijft werken)', () => {
    expect(resolveStripeRouting({ id: 'studio-akke', is_internal_tenant: true })).toEqual({ account: 'platform' });
  });

  it('VanXcel met billing_exempt en eigen Connect-account → eigen account, nooit SellQo', () => {
    const vanxcel = { id: 'vanxcel', is_internal_tenant: false, billing_exempt: true, stripe_account_id: 'acct_vanxcel' };
    expect(resolveStripeRouting(vanxcel)).toEqual({ account: 'connected', stripeAccountId: 'acct_vanxcel' });
  });

  it('billing_exempt zonder Connect-account → fout (geen stille omweg via het platform)', () => {
    expect(() => resolveStripeRouting({ id: 'x', billing_exempt: true } as never)).toThrow(/cannot charge/);
  });
});

describe('isBillingExempt — beide vlaggen werken op alle vrijstellingsplekken', () => {
  it('billing_exempt of is_internal_tenant → vrijgesteld', () => {
    expect(isBillingExempt({ billing_exempt: true })).toBe(true);
    expect(isBillingExempt({ is_internal_tenant: true })).toBe(true);
    expect(isBillingExempt({ is_internal_tenant: true, billing_exempt: true })).toBe(true);
  });
  it('geen van beide, null of ontbrekend → niet vrijgesteld', () => {
    expect(isBillingExempt({ is_internal_tenant: false, billing_exempt: false })).toBe(false);
    expect(isBillingExempt({ is_internal_tenant: null, billing_exempt: null })).toBe(false);
    expect(isBillingExempt(null)).toBe(false);
  });
});

describe('winkelkiezer na de splitsing (keuze Akke 01-10)', () => {
  it('Mijn winkels = SellQo zelf of billing_exempt', () => {
    const tenants = [
      { id: '1', name: 'SellQo', is_internal_tenant: true, billing_exempt: false },
      { id: '2', name: 'VanXcel', is_internal_tenant: false, billing_exempt: true },
      { id: '3', name: 'Studio Akke', is_internal_tenant: true, billing_exempt: true },
      { id: '4', name: 'Astra Sleep', is_internal_tenant: false, billing_exempt: false },
    ];
    const groups = groupTenants(tenants, true)!;
    expect(groups.map((g) => [g.key, g.tenants.map((t) => t.name)])).toEqual([
      ['own', ['SellQo', 'Studio Akke', 'VanXcel']],
      ['clients', ['Astra Sleep']],
    ]);
  });
});

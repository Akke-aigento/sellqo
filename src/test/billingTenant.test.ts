import { describe, expect, it } from 'vitest';
import { BILLING_TENANT_SLUG, loadBillingTenant } from '../../supabase/functions/_shared/billingTenant.ts';

// HOTFIX-BILLING-TENANT-1 — de facturatietenant op slug, niet op is_internal_tenant.

function recordingClient(result: unknown) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = {
    select: (cols: string) => { calls.push(['select', cols]); return builder; },
    eq: (col: string, val: unknown) => { calls.push(['eq', col, val]); return builder; },
    maybeSingle: async () => ({ data: result, error: null }),
  };
  return { calls, client: { from: (t: string) => { calls.push(['from', t]); return builder; } } };
}

describe('loadBillingTenant', () => {
  it('zoekt op slug sellqo, nooit op is_internal_tenant', async () => {
    const { calls, client } = recordingClient({ id: 'd03c63fe' });
    const { data } = await loadBillingTenant(client, 'id');
    expect(data).toEqual({ id: 'd03c63fe' });
    expect(calls).toContainEqual(['eq', 'slug', BILLING_TENANT_SLUG]);
    expect(calls.some((c) => c[0] === 'eq' && c[1] === 'is_internal_tenant')).toBe(false);
  });

  it('voegt id toe als die niet gevraagd is', async () => {
    const { calls, client } = recordingClient(null);
    await loadBillingTenant(client, 'stripe_account_id, is_demo');
    expect(calls).toContainEqual(['select', 'id, stripe_account_id, is_demo']);
  });
});

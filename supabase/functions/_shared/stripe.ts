// Resolves the correct Stripe secret key based on tenant demo status.
// Live tenants use STRIPE_SECRET_KEY. Demo (sandbox) tenants use STRIPE_TEST_SECRET_KEY.
// If STRIPE_TEST_SECRET_KEY is not configured, demo tenants fall back to live key with a warning.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export interface StripeResolution {
  stripe: Stripe;
  keyMode: 'live' | 'test';
  keyUsed: string; // the actual key string — for debugging only, never log this
}

/**
 * Get a Stripe client for a specific tenant.
 * Automatically picks test key for is_demo tenants, live key otherwise.
 */
export async function getStripeForTenant(
  supabase: any,
  tenantId: string,
  apiVersion: string = "2025-08-27.basil"
): Promise<StripeResolution> {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, is_demo')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    console.warn('[stripe-resolver] Could not load tenant, defaulting to live:', error.message);
    return getStripeLive(apiVersion);
  }

  if (tenant?.is_demo) {
    return getStripeTest(apiVersion);
  }

  return getStripeLive(apiVersion);
}

/**
 * Get a Stripe test client explicitly. Use when you already know the context is test.
 */
export function getStripeTest(apiVersion: string = "2025-08-27.basil"): StripeResolution {
  const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  if (!testKey) {
    console.warn('[stripe-resolver] STRIPE_TEST_SECRET_KEY not set, falling back to live key');
    return getStripeLive(apiVersion);
  }
  return {
    stripe: new Stripe(testKey, { apiVersion } as any),
    keyMode: 'test',
    keyUsed: testKey,
  };
}

/**
 * Get a Stripe live client explicitly. Use for platform-level operations
 * (SellQo's own subscriptions, platform webhooks, etc.) that never use test mode.
 */
export function getStripeLive(apiVersion: string = "2025-08-27.basil"): StripeResolution {
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!liveKey) throw new Error("STRIPE_SECRET_KEY is not set");
  return {
    stripe: new Stripe(liveKey, { apiVersion } as any),
    keyMode: 'live',
    keyUsed: liveKey,
  };
}

/**
 * Get a Stripe client for a Stripe connected account ID, inferring test/live from the account prefix.
 * Useful for webhook handlers where the tenant_id is not yet known.
 *
 * Stripe test mode connected accounts look identical to live ones (both start with `acct_`),
 * so this function works by trying test mode first if test key is configured, and falls back
 * to live mode if test key retrieval fails.
 */
export async function getStripeForAccountId(
  accountId: string,
  apiVersion: string = "2025-08-27.basil"
): Promise<StripeResolution> {
  const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");

  if (testKey) {
    try {
      const testStripe = new Stripe(testKey, { apiVersion } as any);
      await testStripe.accounts.retrieve(accountId);
      return { stripe: testStripe, keyMode: 'test', keyUsed: testKey };
    } catch (e: any) {
      // If the account doesn't exist in test mode, fall through to live
      if (e?.code !== 'resource_missing' && e?.type !== 'StripePermissionError') {
        console.warn('[stripe-resolver] Test mode retrieve failed unexpectedly:', e?.message);
      }
    }
  }

  return getStripeLive(apiVersion);
}
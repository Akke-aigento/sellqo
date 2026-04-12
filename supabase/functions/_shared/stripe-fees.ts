/**
 * Shared Stripe fee calculation and payment method helpers
 * Used by the canonical checkout flow.
 */

// Known Stripe fee structures (EU / NL merchant defaults)
// These are approximate and may vary by account agreement.
const STRIPE_FEES: Record<string, { fixedCents: number; percentBps: number }> = {
  card:       { fixedCents: 25, percentBps: 150 },   // 1.5% + €0.25 (EU cards)
  ideal:      { fixedCents: 29, percentBps: 0 },      // €0.29 flat
  bancontact: { fixedCents: 25, percentBps: 140 },    // 1.4% + €0.25
  klarna:     { fixedCents: 35, percentBps: 299 },    // 2.99% + €0.35
};

export interface StripeFeeResult {
  feeCents: number;
  method: string;
}

/**
 * Calculate the Stripe transaction fee for a given payment method and amount.
 * @param method - Payment method code (e.g. 'card', 'ideal', 'bancontact', 'klarna')
 * @param amountCents - Total amount in cents
 * @returns The calculated fee in cents, or 0 if method is unknown
 */
export function calculateStripeFee(method: string, amountCents: number): StripeFeeResult {
  const fee = STRIPE_FEES[method];
  if (!fee) {
    return { feeCents: 0, method };
  }

  const feeCents = Math.round(fee.fixedCents + (amountCents * fee.percentBps) / 10000);
  return { feeCents, method };
}

// Valid payment method codes we support
const VALID_METHOD_CODES = ['card', 'ideal', 'bancontact', 'klarna'] as const;

// Map our method codes to Stripe capability names
const CAPABILITY_MAP: Record<string, string> = {
  card: 'card_payments',
  ideal: 'ideal_payments',
  bancontact: 'bancontact_payments',
  klarna: 'klarna_payments',
};

export interface AvailableMethodsInput {
  /** Methods the tenant has enabled (from tenants.stripe_payment_methods JSONB) */
  tenantConfiguredMethods: string[];
  /** Stripe account capabilities object (from stripe.accounts.retrieve) */
  accountCapabilities: Record<string, string>;
  /** Optional: if the customer selected a specific method, restrict to just that one */
  preferredMethod?: string | null;
}

export interface AvailableMethodsResult {
  methods: string[];
  preferred: string | null;
}

/**
 * Determine available payment methods by intersecting:
 * 1. Tenant-configured methods (stripe_payment_methods JSONB)
 * 2. Active Stripe account capabilities
 * 3. Optionally restrict to a single preferred method
 */
export function getAvailablePaymentMethods(input: AvailableMethodsInput): AvailableMethodsResult {
  const { tenantConfiguredMethods, accountCapabilities, preferredMethod } = input;

  // Sanitize: only keep valid codes
  const sanitized = (tenantConfiguredMethods || ['card', 'ideal', 'bancontact'])
    .filter((m: string) => (VALID_METHOD_CODES as readonly string[]).includes(m));

  const hasCapabilities = Object.keys(accountCapabilities).length > 0;

  // If a specific preferred method was requested, validate and return just that
  if (preferredMethod && (VALID_METHOD_CODES as readonly string[]).includes(preferredMethod)) {
    const cap = CAPABILITY_MAP[preferredMethod];
    const isActive = !hasCapabilities || (cap && accountCapabilities[cap] === 'active');
    return {
      methods: isActive ? [preferredMethod] : [],
      preferred: preferredMethod,
    };
  }

  // Intersect configured methods with active capabilities
  const methods = hasCapabilities
    ? sanitized.filter((m: string) => {
        const cap = CAPABILITY_MAP[m];
        return cap && accountCapabilities[cap] === 'active';
      })
    : sanitized;

  return { methods, preferred: null };
}

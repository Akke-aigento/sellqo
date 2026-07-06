/**
 * Edge-function copy of src/lib/audiencePresets.ts — MUST stay in sync.
 * Relative dates are computed on every send so a campaign scheduled today
 * and sent two weeks later evaluates the window at send time.
 */

export interface PresetRules {
  customer_type?: 'b2c' | 'b2b';
  min_orders?: number;
  max_orders?: number;
  created_after?: string;
  no_order_since_days?: number;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function resolvePresetRules(key: string | null | undefined): PresetRules | null {
  switch (key) {
    case 'preset:new_subscribers':
      return { customer_type: 'b2c', max_orders: 0 };
    case 'preset:new_customers':
      return { min_orders: 1, created_after: daysAgo(30) };
    case 'preset:returning_customers':
      return { min_orders: 2 };
    case 'preset:inactive_customers':
      return { min_orders: 1, no_order_since_days: 90 };
    case 'preset:b2b_customers':
      return { customer_type: 'b2b' };
    default:
      return null;
  }
}
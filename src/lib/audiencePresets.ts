import type { SegmentFilterRules } from '@/types/marketing';

/**
 * System audience quick-presets shown above saved segments in the Doelgroep
 * dropdown. `filter_rules` are computed at SELECTION time in the UI (for
 * preview counts) and again SERVER-SIDE at SEND time (so relative dates like
 * "< 30 days" are evaluated when the campaign actually goes out).
 */
export interface AudiencePreset {
  key: string;
  label: string;
  description: string;
  build: () => SegmentFilterRules;
}

const daysAgo = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
};

export const AUDIENCE_PRESETS: AudiencePreset[] = [
  {
    key: 'preset:new_subscribers',
    label: 'Nieuwe subscribers (nog geen aankoop)',
    description: 'Klanten met status prospect; hebben zich ingeschreven maar nog niet besteld.',
    build: () => ({ customer_type: 'b2c' as const, max_orders: 0 }),
  },
  {
    key: 'preset:new_customers',
    label: 'Nieuwe klanten (eerste bestelling < 30 dagen)',
    description: 'Klanten die minstens 1 keer besteld hebben en pas recent klant zijn geworden.',
    build: () => ({ min_orders: 1, created_after: daysAgo(30) }),
  },
  {
    key: 'preset:returning_customers',
    label: 'Terugkerende klanten (2+ bestellingen)',
    description: 'Klanten die vaker dan één keer besteld hebben.',
    build: () => ({ min_orders: 2 }),
  },
  {
    key: 'preset:inactive_customers',
    label: 'Inactieve klanten (90+ dagen geen bestelling)',
    description: 'Voormalige klanten die al minstens 90 dagen niet meer besteld hebben.',
    build: () => ({ min_orders: 1, no_order_since_days: 90 }),
  },
  {
    key: 'preset:b2b_customers',
    label: 'Zakelijke klanten (B2B)',
    description: 'Alle klanten met klanttype zakelijk.',
    build: () => ({ customer_type: 'b2b' as const }),
  },
];

export function getAudiencePreset(key: string | null | undefined): AudiencePreset | undefined {
  if (!key) return undefined;
  return AUDIENCE_PRESETS.find((p) => p.key === key);
}
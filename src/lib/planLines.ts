// PRICE-2 / MKT-4 — wat een plan bevat. Alleen vlaggen die het product echt waarmaakt
// (visual_editor, multi_warehouse en whiteLabel doen vandaag niets en staan er dus niet).
// Volgt uit de limieten en feature-vlaggen in pricing_plans, zodat marketingsite, /pricing
// en onboarding nooit uiteenlopen.
import type { TFunction } from 'i18next';
import type { PricingPlan } from '@/types/billing';

const FEATURE_LINES: { key: string; label: string }[] = [
  { key: 'horeca', label: 'feat_horeca' },
  { key: 'events', label: 'feat_events' },
  { key: 'webshop_builder', label: 'feat_webshop' },
  { key: 'pos', label: 'feat_pos' },
  { key: 'customDomain', label: 'feat_domain' },
  { key: 'bol_com', label: 'feat_bol' },
  { key: 'odoo_sync', label: 'feat_odoo' },
  { key: 'loyalty_program', label: 'feat_loyalty' },
  { key: 'prioritySupport', label: 'feat_priority' },
];

export function planLines(plan: PricingPlan, t: TFunction, lng: string): { lines: string[]; note: string | null } {
  const k = (x: string, o?: Record<string, unknown>) => t(`landing.pricing.${x}`, o);
  const f = plan.features as unknown as Record<string, boolean | undefined>;
  const aiCredits = Number((plan as unknown as { ai_credits_monthly?: number }).ai_credits_monthly ?? 0);
  const limit = (n: number | null, one: string, many: string, unlimited: string) =>
    n == null || n < 0 ? k(unlimited) : n === 1 ? k(one) : k(many, { n: n.toLocaleString(lng) });
  return {
    lines: [
      limit(plan.limit_products, 'lim_products_one', 'lim_products', 'lim_products_unlimited'),
      limit(plan.limit_orders, 'lim_orders_one', 'lim_orders', 'lim_orders_unlimited'),
      limit(plan.limit_users, 'lim_users_one', 'lim_users', 'lim_users_unlimited'),
      ...FEATURE_LINES.filter((l) => f[l.key]).map((l) => k(l.label)),
      ...(aiCredits > 0 ? [k('feat_ai', { n: aiCredits.toLocaleString(lng) })] : []),
    ],
    note: null,
  };
}

export const eur = (n: number, lng: string) =>
  new Intl.NumberFormat(lng, { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

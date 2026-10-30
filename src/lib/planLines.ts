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
  { key: 'event_seating', label: 'feat_seating' },
  { key: 'prioritySupport', label: 'feat_priority' },
  // AI-AGENT-1: de hulpassistent zet acties klaar (bevestigen, 1 AI-credit per actie).
  { key: 'ai_actions', label: 'feat_ai_actions' },
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
      // LIMITS-1: boven het gratis orderlimiet blijft de webshop open, met een percentage per order.
      plan.limit_orders != null && Number(plan.overage_fee_percent ?? 0) > 0
        ? k('lim_orders_overage', { n: plan.limit_orders.toLocaleString(lng), pct: Number(plan.overage_fee_percent).toLocaleString(lng) })
        : limit(plan.limit_orders, 'lim_orders_one', 'lim_orders', 'lim_orders_unlimited'),
      limit(plan.limit_users, 'lim_users_one', 'lim_users', 'lim_users_unlimited'),
      // MAIL-LIMIT-UI: afgedwongen in enqueue_campaign_sends (marketing_email_limit). Ontbreekt de
      // kolom in de rij (undefined), dan geen regel: nooit "onbeperkt" beloven zonder bron.
      ...(plan.limit_marketing_emails_monthly === undefined
        ? []
        : [limit(plan.limit_marketing_emails_monthly, 'lim_mails', 'lim_mails', 'lim_mails_unlimited')]),
      ...FEATURE_LINES.filter((l) => f[l.key]).map((l) => k(l.label)),
      ...(aiCredits > 0 ? [k('feat_ai', { n: aiCredits.toLocaleString(lng) })] : []),
    ],
    note: null,
  };
}

export const eur = (n: number, lng: string) =>
  new Intl.NumberFormat(lng, { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

/**
 * PLANS-I18N-1 — weergavenaam van een plan. pricing_plans.name is één (Nederlands/Engels)
 * label; per taal staat de naam in landing.pricing.name_<id>. Free/Starter/Pro/Enterprise
 * hebben geen sleutel en vallen terug op de DB-naam. Enkel voor weergave: nooit gebruiken
 * om op te matchen (getTierKey e.d. blijven plan.name lezen).
 */
export const planDisplayName = (plan: { id: string; name: string }, t: TFunction) =>
  t(`landing.pricing.name_${plan.id}`, { defaultValue: plan.name });

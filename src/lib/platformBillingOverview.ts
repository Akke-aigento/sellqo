// PLATFORM-FIGURES-1 — alle geldcijfers van het platformbeheer komen uit één RPC,
// platform_billing_overview(), die de echte facturatie leest (native abonnementen,
// betaalverzoeken, facturen en creditnota's op de SellQo-tenant). Zie de migratie
// 20261027160000_platform_figures_1.sql voor de regels. Bedragen in euro.

export type TenantBillingCategory = 'client' | 'own' | 'demo' | 'on_hold';

export interface TenantBillingFigures {
  tenant_id: string;
  name: string;
  category: TenantBillingCategory;
  status: string | null;
  plan_id: string | null;
  billing_interval: string | null;
  trial_end: string | null;
  /** Lopende abonnementsregels per maand, excl. btw. */
  mrr_net: number;
  /** Betaald aan SellQo min creditnota's op betaalde facturen. */
  paid_gross: number;
  paid_net: number;
  credited_gross: number;
  paid_invoices: number;
  last_paid_at: string | null;
  /** Open betaalverzoeken + onbetaalde facturen, incl. btw. */
  open_gross: number;
  open_due_date: string | null;
  open_expired: boolean | null;
  fees_net: number;
  fees_uninvoiced_net: number;
  /** De webshop van de tenant zelf (niet wat SellQo ontvangt). */
  shop_orders: number;
  shop_revenue_gross: number;
  shop_customers: number;
}

export interface PlatformBillingDocument {
  kind: 'invoice' | 'credit_note';
  id: string;
  number: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  /** Creditnota's negatief. */
  total: number;
  doc_date: string;
  paid_at: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  customer_name: string | null;
}

export interface PlatformBillingTotals {
  mrr_net: number;
  paying_customers: number;
  paid_gross: number;
  paid_net: number;
  open_gross: number;
  open_count: number;
  paid_gross_other: number;
  paid_gross_unassigned: number;
  paid_gross_all: number;
  paid_gross_this_month: number;
}

export interface PlatformBillingOverview {
  generated_at: string;
  tenants: TenantBillingFigures[];
  totals: PlatformBillingTotals;
  by_plan: { plan_id: string | null; count: number; mrr_net: number }[];
  documents: PlatformBillingDocument[];
}

const num = (v: unknown) => Number(v ?? 0) || 0;

/** Getallen uit jsonb kunnen als string binnenkomen (numeric); hier één keer omgezet. */
export function normalizeOverview(raw: unknown): PlatformBillingOverview {
  const r = (raw ?? {}) as Record<string, unknown>;
  const totals = (r.totals ?? {}) as Record<string, unknown>;
  const T = (k: keyof PlatformBillingTotals) => num(totals[k]);
  return {
    generated_at: String(r.generated_at ?? ''),
    tenants: ((r.tenants as Record<string, unknown>[]) ?? []).map((t) => ({
      ...(t as unknown as TenantBillingFigures),
      mrr_net: num(t.mrr_net),
      paid_gross: num(t.paid_gross),
      paid_net: num(t.paid_net),
      credited_gross: num(t.credited_gross),
      paid_invoices: num(t.paid_invoices),
      open_gross: num(t.open_gross),
      fees_net: num(t.fees_net),
      fees_uninvoiced_net: num(t.fees_uninvoiced_net),
      shop_orders: num(t.shop_orders),
      shop_revenue_gross: num(t.shop_revenue_gross),
      shop_customers: num(t.shop_customers),
    })),
    totals: {
      mrr_net: T('mrr_net'),
      paying_customers: T('paying_customers'),
      paid_gross: T('paid_gross'),
      paid_net: T('paid_net'),
      open_gross: T('open_gross'),
      open_count: T('open_count'),
      paid_gross_other: T('paid_gross_other'),
      paid_gross_unassigned: T('paid_gross_unassigned'),
      paid_gross_all: T('paid_gross_all'),
      paid_gross_this_month: T('paid_gross_this_month'),
    },
    by_plan: ((r.by_plan as Record<string, unknown>[]) ?? []).map((p) => ({
      plan_id: (p.plan_id as string | null) ?? null,
      count: num(p.count),
      mrr_net: num(p.mrr_net),
    })),
    documents: ((r.documents as Record<string, unknown>[]) ?? []).map((d) => ({
      ...(d as unknown as PlatformBillingDocument),
      subtotal: num(d.subtotal),
      tax_amount: num(d.tax_amount),
      total: num(d.total),
    })),
  };
}

export const BILLING_CATEGORY_LABEL: Record<TenantBillingCategory, string> = {
  client: 'Klant',
  own: 'Eigen winkel',
  demo: 'Demo/test',
  on_hold: 'Facturatie on hold',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  trialing: 'Trial',
  active: 'Actief',
  past_due: 'Achterstallig',
  restricted: 'Beperkt (leesmodus)',
  suspended: 'Geblokkeerd',
  canceled: 'Geannuleerd',
  unpaid: 'Onbetaald',
};

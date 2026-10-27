import { describe, expect, it } from 'vitest';
import { normalizeOverview } from './platformBillingOverview';

// PLATFORM-FIGURES-1 — de RPC geeft numeric als string terug; nooit /100 (euro, geen centen).
describe('normalizeOverview', () => {
  it('zet numeric-strings om naar getallen, in euro', () => {
    const o = normalizeOverview({
      generated_at: '2026-10-27T14:00:00Z',
      totals: { mrr_net: '29.00', paid_gross: '130.68', paid_net: 108, open_gross: '0', paying_customers: 1 },
      tenants: [{ tenant_id: 't', name: 'Astra Sleep', category: 'client', mrr_net: '29.00', paid_gross: '130.68', shop_revenue_gross: '12621.01' }],
      by_plan: [{ plan_id: 'starter', count: 1, mrr_net: '29' }],
      documents: [{ kind: 'credit_note', id: 'c', number: 'CN-1', status: 'sent', subtotal: '-5', tax_amount: '-1.05', total: '-6.05', doc_date: '2026-08-01' }],
    });
    expect(o.totals.mrr_net).toBe(29);
    expect(o.totals.paid_gross).toBe(130.68);
    expect(o.totals.paid_gross_all).toBe(0);
    expect(o.tenants[0].paid_gross).toBe(130.68);
    expect(o.tenants[0].shop_revenue_gross).toBe(12621.01);
    expect(o.tenants[0].open_gross).toBe(0);
    expect(o.by_plan[0].mrr_net).toBe(29);
    expect(o.documents[0].total).toBe(-6.05);
  });

  it('leeg antwoord geeft nullen, geen crash', () => {
    const o = normalizeOverview(null);
    expect(o.tenants).toEqual([]);
    expect(o.documents).toEqual([]);
    expect(o.totals.mrr_net).toBe(0);
  });
});

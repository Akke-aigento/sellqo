import { describe, expect, it } from 'vitest';
import { decideTrialEnd, normalizeInterval } from '../../supabase/functions/_shared/trialEnd';
import { reusablePaymentMethod, wantsMandateSave, withSaveMandate } from '../../supabase/functions/_shared/linkMandate';
import { tenantPeriodAfterSettle } from '../../supabase/functions/_shared/tenantPeriod';
import { resolveStripeCustomerId } from '../../supabase/functions/_shared/stripeCustomer';

// BILL-FIX-1 (11-10-2026) — trial-einde, mandaat via betaallink, één Stripe-klant,
// tenantperiode na afrekening. Geen live-betalingen.

const NOW = new Date('2026-10-28T07:00:00Z');
const past = '2026-10-27T00:00:00Z';
const future = '2026-11-10T00:00:00Z';
const klant = { is_demo: false, is_internal_tenant: false, billing_exempt: false, billing_on_hold: false };
const trial = { plan_id: 'starter', status: 'active', trial_end: past, billing_subscription_id: null };

describe('decideTrialEnd', () => {
  it('klantwinkel na trial, status active (Mancini-geval) → activate', () => {
    expect(decideTrialEnd(klant, trial, NOW)).toBe('activate');
  });
  it('status trialing → ook activate (vroeger: stil naar free)', () => {
    expect(decideTrialEnd(klant, { ...trial, status: 'trialing' }, NOW)).toBe('activate');
  });
  it('trial nog niet voorbij → not_expired', () => {
    expect(decideTrialEnd(klant, { ...trial, trial_end: future }, NOW)).toBe('not_expired');
  });
  it('gratis tot omschakeling → hold, nooit factureren', () => {
    expect(decideTrialEnd({ ...klant, billing_on_hold: true }, trial, NOW)).toBe('hold');
  });
  it('eigen winkel (billing_exempt) of SellQo-intern → trial wissen', () => {
    expect(decideTrialEnd({ ...klant, billing_exempt: true }, trial, NOW)).toBe('clear_exempt');
    expect(decideTrialEnd({ ...klant, is_internal_tenant: true }, trial, NOW)).toBe('clear_exempt');
  });
  it('demo of onbekende tenant → niet aanraken', () => {
    expect(decideTrialEnd({ ...klant, is_demo: true }, trial, NOW)).toBe('skip_demo');
    expect(decideTrialEnd(null, trial, NOW)).toBe('skip_demo');
  });
  it('free-plan, bestaand abonnement of gestopte status → niets', () => {
    expect(decideTrialEnd(klant, { ...trial, plan_id: 'free' }, NOW)).toBe('skip_free');
    expect(decideTrialEnd(klant, { ...trial, billing_subscription_id: 'sub' }, NOW)).toBe('skip_has_billing');
    expect(decideTrialEnd(klant, { ...trial, status: 'canceled' }, NOW)).toBe('skip_status');
  });
  it('interval: alleen yearly of monthly', () => {
    expect(normalizeInterval('yearly')).toBe('yearly');
    expect(normalizeInterval('weekly')).toBe('monthly');
    expect(normalizeInterval(null)).toBe('monthly');
  });
});

describe('withSaveMandate', () => {
  const base = {
    mode: 'payment',
    customer_email: 'marawan@example.com',
    metadata: { billing_cycle_id: 'c1', tenant_id: 't1' },
    payment_intent_data: { metadata: { billing_cycle_id: 'c1', tenant_id: 't1' } },
  };
  it('zet customer i.p.v. customer_email en vraagt off_session-opslag', () => {
    const p = withSaveMandate(base, 'cus_1', 'k1');
    expect(p.customer).toBe('cus_1');
    expect(p).not.toHaveProperty('customer_email');
    expect(p.payment_intent_data.setup_future_usage).toBe('off_session');
  });
  it('behoudt de afboek-metadata en voegt de vlag toe op sessie én intent', () => {
    const p = withSaveMandate(base, 'cus_1', 'k1');
    expect(p.payment_intent_data.metadata).toEqual({ billing_cycle_id: 'c1', tenant_id: 't1', save_mandate: '1', mandate_customer_id: 'k1' });
    expect(p.metadata.save_mandate).toBe('1');
    expect(base).toHaveProperty('customer_email'); // origineel ongemoeid
  });
  it('wantsMandateSave leest exact die vlag', () => {
    expect(wantsMandateSave({ save_mandate: '1', mandate_customer_id: 'k1', tenant_id: 't1' })).toBe(true);
    expect(wantsMandateSave({ save_mandate: '1', tenant_id: 't1' })).toBe(false);
    expect(wantsMandateSave({ billing_cycle_id: 'c1', tenant_id: 't1' })).toBe(false);
    expect(wantsMandateSave(null)).toBe(false);
  });
});

describe('reusablePaymentMethod', () => {
  it('kaart en SEPA: het betaalmiddel zelf', () => {
    expect(reusablePaymentMethod('card', 'pm_c')).toEqual({ paymentMethodId: 'pm_c', methodType: 'card' });
    expect(reusablePaymentMethod('sepa_debit', 'pm_s')).toEqual({ paymentMethodId: 'pm_s', methodType: 'sepa_debit' });
  });
  it('Bancontact/iDEAL: het gegenereerde SEPA-mandaat', () => {
    expect(reusablePaymentMethod('bancontact', 'pm_b', { bancontact: { generated_sepa_debit: 'pm_gen' } }))
      .toEqual({ paymentMethodId: 'pm_gen', methodType: 'sepa_debit' });
    expect(reusablePaymentMethod('ideal', 'pm_i', { ideal: { generated_sepa_debit: { id: 'pm_gen2' } } }))
      .toEqual({ paymentMethodId: 'pm_gen2', methodType: 'sepa_debit' });
  });
  it('zonder gegenereerd mandaat of onbekend type → niets bewaren', () => {
    expect(reusablePaymentMethod('bancontact', 'pm_b', {})).toBeNull();
    expect(reusablePaymentMethod('paypal', 'pm_p')).toBeNull();
    expect(reusablePaymentMethod(null, 'pm_x')).toBeNull();
  });
});

describe('tenantPeriodAfterSettle', () => {
  const okt = { cycle_type: 'recurring', period_start: '2026-10-01', period_end: '2026-11-01' };
  it('Astra-geval: stond op 1/10, oktober betaald → 1/10–1/11', () => {
    expect(tenantPeriodAfterSettle('2026-10-01T00:00:00+00:00', okt)).toEqual({
      current_period_start: '2026-10-01T00:00:00Z',
      current_period_end: '2026-11-01T00:00:00Z',
    });
  });
  it('nooit terug: late betaling van een oudere periode', () => {
    expect(tenantPeriodAfterSettle('2026-12-01T00:00:00Z', okt)).toBeNull();
    expect(tenantPeriodAfterSettle('2026-11-01T00:00:00Z', okt)).toBeNull();
  });
  it('proration-cycles verschuiven de periode niet', () => {
    expect(tenantPeriodAfterSettle(null, { ...okt, cycle_type: 'proration' })).toBeNull();
  });
});

// Kleine nep-client: per tabel een vast antwoord, ketenbare filters.
function fakeDb(answers: Record<string, unknown>) {
  return {
    from(table: string) {
      const result = answers[table];
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'not', 'order', 'limit']) {
        b[m] = () => (m === 'limit' ? Promise.resolve({ data: result ?? [], error: null }) : b);
      }
      b.maybeSingle = () => Promise.resolve({ data: result ?? null, error: null });
      return b;
    },
  };
}
function fakeStripe(opts: { alive?: boolean } = {}) {
  const created: unknown[] = [];
  return {
    created,
    ctx: {
      keyMode: 'live' as const,
      onPlatformAccount: true,
      stripe: {
        customers: {
          retrieve: async (id: string) => (opts.alive === false ? { id, deleted: true } : { id }),
          create: async (params: unknown) => { created.push(params); return { id: 'cus_new' }; },
        },
      },
    },
  };
}
const ozay = { id: 'k1', email: 'marawan@example.com', company_name: 'Ozay Group Belgium BV' };

describe('resolveStripeCustomerId', () => {
  it('mandaat gaat voor', async () => {
    const s = fakeStripe();
    const r = await resolveStripeCustomerId(fakeDb({ customer_payment_mandates: { stripe_customer_id: 'cus_m' } }), s.ctx as never, { tenantId: 't', customer: ozay });
    expect(r).toEqual({ stripeCustomerId: 'cus_m', source: 'mandate' });
    expect(s.created).toHaveLength(0);
  });
  it('zonder mandaat: Stripe-klant van het recentste token hergebruiken (geen 10e klant)', async () => {
    const s = fakeStripe();
    const r = await resolveStripeCustomerId(fakeDb({ mandate_setup_tokens: [{ stripe_customer_id: 'cus_tok' }] }), s.ctx as never, { tenantId: 't', customer: ozay });
    expect(r).toEqual({ stripeCustomerId: 'cus_tok', source: 'token' });
    expect(s.created).toHaveLength(0);
  });
  it('token-klant verwijderd in Stripe → nieuwe aanmaken', async () => {
    const s = fakeStripe({ alive: false });
    const r = await resolveStripeCustomerId(fakeDb({ mandate_setup_tokens: [{ stripe_customer_id: 'cus_gone' }] }), s.ctx as never, { tenantId: 't', customer: ozay });
    expect(r.source).toBe('created');
    expect(s.created).toHaveLength(1);
  });
  it('niets bekend → één nieuwe klant met tenant- en klant-metadata', async () => {
    const s = fakeStripe();
    const r = await resolveStripeCustomerId(fakeDb({}), s.ctx as never, { tenantId: 't', customer: ozay, metadata: { platform_tenant_id: 'p' } });
    expect(r).toEqual({ stripeCustomerId: 'cus_new', source: 'created' });
    expect(s.created[0]).toMatchObject({ name: 'Ozay Group Belgium BV', metadata: { tenant_id: 't', customer_id: 'k1', platform_tenant_id: 'p' } });
  });
});

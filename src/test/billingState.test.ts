import { describe, expect, it } from 'vitest';
import {
  billingAllows, cycleDueDates, resolveBillingState, GRACE_DAYS, PAY_FIRST_TERM_DAYS,
  RESTRICTED_TO_SUSPENDED_DAYS,
} from '../../supabase/functions/_shared/billingState';

// BILLING-ENFORCE-1: niets dwong betaling af ("suspension is LOCK-1", nooit
// gebouwd). Deze machine weegt pay-first-cycli en domeinfacturen samen.

const NOW = '2026-09-24';

describe('cycleDueDates — de vervaldatum-bug', () => {
  it('normale run: vervaldatum vanaf de periodestart', () => {
    expect(cycleDueDates({ periodStart: '2026-10-01', today: '2026-09-26' }))
      .toEqual({ dueDate: '2026-10-08', graceUntil: '2026-10-22' });
  });
  it('inhaalrun met terugwerkende kracht: nooit een vervaldatum in het verleden', () => {
    // Periode begon 1 september, cyclus wordt pas op 24 september aangemaakt.
    expect(cycleDueDates({ periodStart: '2026-09-01', today: NOW }))
      .toEqual({ dueDate: '2026-10-01', graceUntil: '2026-10-15' });
  });
  it('termijn en respijt zijn de afgesproken 7 en 14 dagen', () => {
    expect(PAY_FIRST_TERM_DAYS).toBe(7);
    expect(GRACE_DAYS).toBe(14);
  });
});

const cycle = (over: Partial<Parameters<typeof resolveBillingState>[0]['cycles'][number]> = {}) => ({
  status: 'awaiting_payment', due_date: '2026-09-01', grace_until: '2026-09-15', total: 35.09,
  checkout_session_url: 'https://pay.example/abc', ...over,
});

describe('resolveBillingState — platformcyclus', () => {
  it('alles betaald → active', () => {
    expect(resolveBillingState({ cycles: [], invoices: [], now: NOW }).state).toBe('active');
  });
  it('binnen de termijn → active', () => {
    const r = resolveBillingState({ cycles: [cycle({ due_date: '2026-10-01', grace_until: '2026-10-15' })], now: NOW });
    expect(r.state).toBe('active');
  });
  it('voorbij de vervaldatum → past_due, met bedrag en betaallink', () => {
    const r = resolveBillingState({ cycles: [cycle({ due_date: '2026-09-20', grace_until: '2026-10-04' })], now: NOW });
    expect(r).toMatchObject({ state: 'past_due', reason: 'cycle_overdue', openAmount: 35.09, payUrl: 'https://pay.example/abc', since: '2026-09-20' });
  });
  it('respijt voorbij → restricted (leesmodus)', () => {
    const r = resolveBillingState({ cycles: [cycle()], now: NOW });
    expect(r).toMatchObject({ state: 'restricted', reason: 'cycle_expired', since: '2026-09-16' });
  });
  it('status expired telt ook zonder grace_until', () => {
    expect(resolveBillingState({ cycles: [cycle({ status: 'expired', grace_until: null })], now: NOW }).state).toBe('restricted');
  });
  it(`${RESTRICTED_TO_SUSPENDED_DAYS} dagen in leesmodus → suspended`, () => {
    const r = resolveBillingState({ cycles: [cycle({ grace_until: '2026-08-01' })], now: NOW });
    expect(r.state).toBe('suspended');
  });
  it('grens: 29 dagen is nog restricted, 30 dagen is suspended', () => {
    const at = (graceUntil: string) => resolveBillingState({ cycles: [cycle({ grace_until: graceUntil })], now: NOW }).state;
    expect(at('2026-08-26')).toBe('restricted'); // restricted sinds 27-08 → 28 dagen
    expect(at('2026-08-24')).toBe('suspended');  // restricted sinds 25-08 → 30 dagen
  });
  it('een cyclus met factuur telt niet meer mee', () => {
    expect(resolveBillingState({ cycles: [cycle({ invoice_id: 'inv-1' })], now: NOW }).state).toBe('active');
  });
});

describe('resolveBillingState — domeinfactuur (invoice-first)', () => {
  const invoice = (over: Record<string, unknown> = {}) => ({
    status: 'sent', dunning_level: 2, due_date: '2026-09-01', total: 121, ...over,
  });
  it('dunning 2 → past_due', () => {
    expect(resolveBillingState({ invoices: [invoice()], now: NOW }).state).toBe('past_due');
  });
  it('dunning 1 → geen gevolg', () => {
    expect(resolveBillingState({ invoices: [invoice({ dunning_level: 1 })], now: NOW }).state).toBe('active');
  });
  it('dunning 3 binnen 14 dagen → nog past_due', () => {
    const r = resolveBillingState({ invoices: [invoice({ dunning_level: 3, last_reminder_at: '2026-09-20T09:00:00Z' })], now: NOW });
    expect(r.state).toBe('past_due');
  });
  it('dunning 3 + 14 dagen → restricted', () => {
    const r = resolveBillingState({ invoices: [invoice({ dunning_level: 3, last_reminder_at: '2026-09-01T09:00:00Z' })], now: NOW });
    expect(r).toMatchObject({ state: 'restricted', reason: 'domain_dunning' });
  });
  it('betaalde factuur telt niet mee', () => {
    expect(resolveBillingState({ invoices: [invoice({ status: 'paid', dunning_level: 3 })], now: NOW }).state).toBe('active');
  });
});

describe('resolveBillingState — trial en combinaties', () => {
  it('trial loopt nog → trialing', () => {
    const r = resolveBillingState({ subscription: { status: 'trialing', trial_end: '2026-10-01' }, now: NOW });
    expect(r).toMatchObject({ state: 'trialing', reason: 'trial' });
  });
  it('trial verlopen zonder openstaand bedrag → active', () => {
    expect(resolveBillingState({ subscription: { status: 'trialing', trial_end: '2026-09-01' }, now: NOW }).state).toBe('active');
  });
  it('een openstaande cyclus weegt zwaarder dan een lopende trial', () => {
    const r = resolveBillingState({ subscription: { status: 'trialing', trial_end: '2026-10-01' }, cycles: [cycle()], now: NOW });
    expect(r.state).toBe('restricted');
  });
  it('twee signalen: de zwaarste wint, bedragen tellen op', () => {
    const r = resolveBillingState({
      cycles: [cycle()],
      invoices: [{ status: 'sent', dunning_level: 2, due_date: '2026-09-10', total: 121 }],
      now: NOW,
    });
    expect(r.state).toBe('restricted');
    expect(r.openAmount).toBe(156.09);
  });
});

describe('billingAllows — wat blijft er open', () => {
  it('lezen mag altijd, in elke toestand', () => {
    for (const state of ['past_due', 'restricted', 'suspended'] as const) {
      expect(billingAllows(state, 'read', 'orders').allowed).toBe(true);
    }
  });
  it('active en trialing: alles mag', () => {
    expect(billingAllows('active', 'write', 'orders').allowed).toBe(true);
    expect(billingAllows('trialing', 'write', 'ai_assistant').allowed).toBe(true);
  });
  it('past_due: alleen AI dicht (variabele kost)', () => {
    expect(billingAllows('past_due', 'write', 'orders').allowed).toBe(true);
    expect(billingAllows('past_due', 'write', 'ai_assistant')).toEqual({ allowed: false, reason: 'billing' });
    expect(billingAllows('past_due', 'write', 'ai_coach').allowed).toBe(false);
  });
  it('restricted en suspended: schrijven dicht', () => {
    for (const state of ['restricted', 'suspended'] as const) {
      expect(billingAllows(state, 'write', 'orders').allowed).toBe(false);
      expect(billingAllows(state, 'write', 'products').allowed).toBe(false);
      expect(billingAllows(state, 'correct', 'order_status').allowed).toBe(false);
    }
  });
  it('betalen, profiel en rapporten blijven open — anders kan niemand eruit komen', () => {
    for (const state of ['restricted', 'suspended'] as const) {
      expect(billingAllows(state, 'write', 'platform_billing').allowed).toBe(true);
      expect(billingAllows(state, 'write', 'profile').allowed).toBe(true);
      expect(billingAllows(state, 'write', 'reports_financial').allowed).toBe(true);
    }
  });
});

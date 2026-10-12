import { describe, expect, it } from 'vitest';
import { decideAiCreditGrant, grantAiCreditPurchase } from '../../supabase/functions/_shared/aiCreditPurchase';

const paid = {
  id: 'cs_1',
  payment_status: 'paid',
  amount_total: 499,
  currency: 'eur',
  payment_intent: 'pi_1',
  metadata: { type: 'ai_credits', purchase_id: 'p1', tenant_id: 't1', credits: '50' },
};

describe('AI-CRED-1 decideAiCreditGrant', () => {
  it('kent een betaalde aankoop toe', () => {
    expect(decideAiCreditGrant(paid)).toEqual({
      kind: 'grant', purchaseId: 'p1', tenantId: 't1', credits: 50, paymentIntentId: 'pi_1', amount: 4.99, currency: 'EUR',
    });
  });
  it('negeert andere checkouts', () => {
    expect(decideAiCreditGrant({ ...paid, metadata: { type: 'addon' } }).kind).toBe('not_ai_credits');
  });
  it('wacht op een onbetaalde (uitgestelde) betaling', () => {
    expect(decideAiCreditGrant({ ...paid, payment_status: 'unpaid' }).kind).toBe('not_paid');
  });
  it('weigert rare metadata', () => {
    expect(decideAiCreditGrant({ ...paid, metadata: { ...paid.metadata, credits: '-5' } }).kind).toBe('invalid');
    expect(decideAiCreditGrant({ ...paid, metadata: { type: 'ai_credits', credits: '50' } }).kind).toBe('invalid');
  });
});

// Minimale nep-client: onthoudt wat er gebeurde.
function fakeDb(opts: { claimRows: unknown[]; addError?: unknown }) {
  const calls: string[] = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    let op = '';
    b.update = () => { op = 'update'; return b; };
    b.insert = () => { calls.push(`insert:${table}`); return Promise.resolve({ error: null }); };
    b.eq = () => b;
    b.select = () => {
      calls.push(`${op}:${table}`);
      return Promise.resolve({ data: opts.claimRows, error: null });
    };
    b.then = (res: (v: unknown) => unknown) => { calls.push(`${op}:${table}`); return Promise.resolve({ error: null }).then(res); };
    return b;
  };
  return {
    calls,
    from: builder,
    rpc: (name: string) => { calls.push(`rpc:${name}`); return Promise.resolve({ error: opts.addError ?? null }); },
  };
}

describe('AI-CRED-1 grantAiCreditPurchase', () => {
  it('claimt, kent toe en maakt een betaalbewijs', async () => {
    const db = fakeDb({ claimRows: [{ id: 'p1', credits_amount: 50 }] });
    expect(await grantAiCreditPurchase(db, paid)).toBe('granted');
    expect(db.calls).toEqual(['update:ai_credit_purchases', 'rpc:add_ai_credits', 'insert:platform_invoices']);
  });
  it('doet niets bij een herhaalde webhook', async () => {
    const db = fakeDb({ claimRows: [] });
    expect(await grantAiCreditPurchase(db, paid)).toBe('already_completed');
    expect(db.calls).not.toContain('rpc:add_ai_credits');
  });
  it('zet terug op pending en meldt een fout als toekennen faalt', async () => {
    const db = fakeDb({ claimRows: [{ id: 'p1', credits_amount: 50 }], addError: { message: 'boom' } });
    const result = await grantAiCreditPurchase(db, paid);
    expect(result).toEqual({ error: 'boom' });
    expect(db.calls).toContain('update:ai_credit_purchases');
    expect(db.calls).not.toContain('insert:platform_invoices');
  });
});

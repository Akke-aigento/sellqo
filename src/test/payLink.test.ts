import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  TOKEN_ALPHABET,
  TOKEN_LENGTH,
  classifyPayment,
  cycleState,
  generatePayToken,
  invoiceState,
  normalizePayToken,
  payLinkUrl,
  payPageBrand,
  routeChargeEvent,
  selectBundleItems,
  settleBundleItems,
  withPendingSession,
  type BundleItem,
} from '../../supabase/functions/_shared/payLink';

// PAY-LINK-1 — vaste betaallink per openstaande post. Geen live-betalingen.

describe('token', () => {
  it('26 tekens Crockford-base32 (130 bit), zonder i, l, o, u', () => {
    const t = generatePayToken();
    expect(t).toHaveLength(TOKEN_LENGTH);
    expect(t).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{26}$/);
    expect(TOKEN_ALPHABET).toHaveLength(32);
    expect(TOKEN_ALPHABET).not.toMatch(/[ilou]/);
  });

  it('elke byte valt gelijkmatig op het alfabet (b & 31)', () => {
    const t = generatePayToken((n) => Uint8Array.from({ length: n }, (_, i) => i * 8 + 3));
    expect(t[0]).toBe(TOKEN_ALPHABET[3]);
    expect(t[4]).toBe(TOKEN_ALPHABET[35 & 31]);
  });

  it('overgetypt: hoofdletters, streepjes en spaties mogen; i/l → 1, o → 0', () => {
    const t = '0123456789abcdefghjkmnpqrs';
    expect(normalizePayToken(t.toUpperCase())).toBe(t);
    expect(normalizePayToken('01234-56789 ABCDE-FGHJK-MNPQRS')).toBe(t);
    expect(normalizePayToken('o123456789abcdefghjkmnpqrs')).toBe(t);
    expect(normalizePayToken('012345678' + '9abcdefghjkmnpqrs'.replace('1', 'l'))).toBe(t);
  });

  it('te kort, te lang of geen tekst → null', () => {
    expect(normalizePayToken('abc')).toBeNull();
    expect(normalizePayToken('0123456789abcdefghjkmnpqrst0')).toBeNull();
    expect(normalizePayToken(42)).toBeNull();
  });

  it('url', () => {
    expect(payLinkUrl('abc', 'https://sellqo.app/')).toBe('https://sellqo.app/betalen/abc');
  });
});

describe('staat per post: open → sessie, anders een pagina', () => {
  it('cyclus', () => {
    expect(cycleState({ status: 'awaiting_payment' })).toBe('open');
    expect(cycleState({ status: 'expired' })).toBe('open'); // juist dit moet betaalbaar zijn
    expect(cycleState({ status: 'reopened' })).toBe('open');
    expect(cycleState({ status: 'settled' })).toBe('paid');
    expect(cycleState({ status: 'awaiting_payment', invoice_id: 'inv' })).toBe('paid');
    expect(cycleState({ status: 'cancelled' })).toBe('cancelled'); // PR-2026-0003
    expect(cycleState({ status: 'processing' })).toBe('processing');
    expect(cycleState(null)).toBe('not_found');
  });

  it('factuur', () => {
    expect(invoiceState({ status: 'unpaid' })).toBe('open'); // SQ-2026-0001
    expect(invoiceState({ status: 'sent' })).toBe('open');
    expect(invoiceState({ status: 'paid' })).toBe('paid');
    expect(invoiceState({ status: 'cancelled' })).toBe('cancelled');
    expect(invoiceState({ status: 'processing' })).toBe('processing');
    expect(invoiceState({ status: 'draft' })).toBe('not_found');
    expect(invoiceState(undefined)).toBe('not_found');
  });

  it('vorige sessie al betaald maar nog niet afgeboekt → in verwerking, geen tweede sessie', () => {
    expect(withPendingSession('open', 'complete')).toBe('processing');
    expect(withPendingSession('open', 'open')).toBe('open');
    expect(withPendingSession('open', 'expired')).toBe('open');
    expect(withPendingSession('paid', 'complete')).toBe('paid');
  });
});

describe('bundel ("Alles betalen")', () => {
  const base = { tenant_id: 'sellqo', customer_id: 'ozay' };
  it('alleen open posten van deze klant in deze tenant, met het totaal', () => {
    const r = selectBundleItems({
      tenantId: 'sellqo',
      customerId: 'ozay',
      cycles: [
        { ...base, id: 'c3', status: 'cancelled', total: 35.09, payment_request_number: 'PR-2026-0003' },
        { ...base, id: 'c4', status: 'awaiting_payment', total: 35.09, payment_request_number: 'PR-2026-0004' },
        { ...base, id: 'c5', status: 'settled', total: 35.09 },
        { ...base, customer_id: 'iemand-anders', id: 'cx', status: 'awaiting_payment', total: 99 },
        { ...base, tenant_id: 'andere-winkel', id: 'cy', status: 'awaiting_payment', total: 99 },
      ],
      invoices: [
        { ...base, id: 'i1', status: 'unpaid', total: '60.50', invoice_number: 'SQ-2026-0001' },
        { ...base, id: 'i2', status: 'paid', total: 10 },
      ],
    });
    expect(r.items).toEqual([
      { type: 'cycle', id: 'c4', number: 'PR-2026-0004', amount: 35.09 },
      { type: 'invoice', id: 'i1', number: 'SQ-2026-0001', amount: 60.5 },
    ]);
    expect(r.total).toBe(95.59);
  });

  it('afwikkeling: elke post één keer, een fout stopt de rest niet', async () => {
    const items: BundleItem[] = [
      { type: 'cycle', id: 'a', number: null, amount: 1 },
      { type: 'invoice', id: 'b', number: null, amount: 2 },
      { type: 'cycle', id: 'a', number: null, amount: 1 },
    ];
    const seen: string[] = [];
    const results = await settleBundleItems(items, async (i) => {
      seen.push(`${i.type}:${i.id}`);
      if (i.id === 'a') throw new Error('kapot');
    });
    expect(seen).toEqual(['cycle:a', 'invoice:b']);
    expect(results.map((r) => r.ok)).toEqual([false, true]);
  });
});

describe('webhook: welke betaling, en wat ermee', () => {
  it('routering: bundel, cyclus, factuur', () => {
    expect(routeChargeEvent('payment_intent.succeeded', { payment_bundle_id: 'b' })).toBe('bundle');
    expect(routeChargeEvent('payment_intent.succeeded', { billing_cycle_id: 'c', invoice_id: 'i' })).toBe('cycle');
    expect(routeChargeEvent('payment_intent.payment_failed', { invoice_id: 'i' })).toBe('invoice');
  });

  it('een webshopbetaling raakt subscriptionCharge niet (stripe-connect-webhook loopt verder)', () => {
    // create-checkout-session (order) en storefront-api (cart, metadata enkel op de sessie)
    expect(routeChargeEvent('payment_intent.succeeded', { order_id: 'o1', tenant_id: 't', order_number: '#1042', vat_type: 'standard' })).toBeNull();
    expect(routeChargeEvent('payment_intent.succeeded', {})).toBeNull();
    expect(routeChargeEvent('payment_intent.succeeded', undefined)).toBeNull();
    expect(routeChargeEvent('checkout.session.completed', { billing_cycle_id: 'c' })).toBeNull();
    expect(routeChargeEvent('charge.refunded', { invoice_id: 'i' })).toBeNull();
  });

  it('afboeken, retry, dubbel, afgesloten', () => {
    expect(classifyPayment({ state: 'open' }, 'pi_1')).toBe('settle');
    expect(classifyPayment({ state: 'processing' }, 'pi_1')).toBe('settle');
    expect(classifyPayment({ state: 'paid', paidIntentId: 'pi_1' }, 'pi_1')).toBe('retry');
    expect(classifyPayment({ state: 'paid', paidIntentId: 'pi_1' }, 'pi_2')).toBe('duplicate');
    expect(classifyPayment({ state: 'paid', paidIntentId: null }, 'pi_2')).toBe('retry'); // van vóór PAY-LINK-1
    expect(classifyPayment({ state: 'cancelled' }, 'pi_3')).toBe('closed_item');
  });
});

describe('branding van de betaalpagina', () => {
  it('factuur van een gewone winkel: het merk van de winkel + "Mogelijk gemaakt door SellQo"', () => {
    const b = payPageBrand({ tenantName: 'VanXcel', logoUrl: 'https://x/logo.png', primaryColor: '#0f0f0f' }, false);
    expect(b).toEqual({ name: 'VanXcel', logoUrl: 'https://x/logo.png', primaryColor: '#0f0f0f', poweredBySellqo: true });
  });
  it('platformpost (tenant SellQo): SellQo, zonder "Mogelijk gemaakt door"', () => {
    const b = payPageBrand({ tenantName: 'SellQo', logoUrl: null, primaryColor: null }, true);
    expect(b).toEqual({ name: 'SellQo', logoUrl: null, primaryColor: '#1d3a5f', poweredBySellqo: false });
  });
  it('geeft nooit e-mailadressen of andere bedrijfsgegevens door', () => {
    const b = payPageBrand({ tenantName: 'X', supportEmail: 'a@b', vatNumber: 'BE1' } as never, false);
    expect(Object.keys(b).sort()).toEqual(['logoUrl', 'name', 'poweredBySellqo', 'primaryColor']);
  });
});

describe('geen factuur vóór betaling', () => {
  it('de link-, checkout- en publieke code schrijft nergens in invoices', () => {
    for (const f of ['supabase/functions/_shared/payCheckout.ts', 'supabase/functions/pay-link/index.ts', 'supabase/functions/_shared/payLink.ts']) {
      const src = readFileSync(f, 'utf8');
      const writes = src.match(/from\(["']invoices["']\)[\s\S]{0,200}?\.(insert|update|upsert|delete)\(/g) ?? [];
      expect(writes, f).toEqual([]);
    }
  });
});
